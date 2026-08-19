import { metrics } from "./observability";
import { AppError, ErrorCode } from "@platform/core";
/**
 * 経費通知の確実配信。承認遷移で発生する通知メールを Outbox に積み(enqueue)、
 * リレー(relay)が mailer で確実に送る。dedup で二重送信を防ぎ、失敗は Outbox が再試行する。
 * これにより「リクエスト完了後にメールが落ちても通知が失われない」を担保する。
 * @packageDocumentation
 */
import type { ApproverDirectory, WorkflowState } from "@platform/workflow";
import { relayOutbox, type OutboxStore } from "@platform/observability";
import { type SeenStore, type NotifyChannel } from "@platform/notify";
import { buildTransitionMails } from "../lib/expense-notify";
import { mailer, log, notifyOutbox, notifySeen } from "./services";
import { preferenceStore } from "./platform-services";
import { decideDelivery, hasChannel } from "./notification-prefs";

/** 承認者ディレクトリ(実運用では DB や設定から取得)。 */
export const APPROVER_DIRECTORY: ApproverDirectory = {
  manager: [{ name: "課長", email: "manager@example.co.jp" }],
  director: [{ name: "部長", email: "director@example.co.jp" }],
};

/** Outbox に積むメール1通分のペイロード。**宛先は必ず1件。** */
interface MailPayload { to: string; subject: string; text: string }

/**
 * 遷移に応じた通知メールを Outbox に積む(確実配信の起点)。
 * 実運用では承認の DB 更新と同一トランザクションで add することで、コミットと通知の整合を取る。
 *
 * **利用者の通知設定を尊重する。** メンション通知・アンケート督促には
 * 既に `decideDelivery` を統合していたが、この経路(経費承認)だけ
 * 決め打ちで送っていた——email を止めている人にも構わず送っていた
 * (2026-08 に統合)。
 */
export async function enqueueExpenseTransition(params: {
  title: string;
  prev: WorkflowState;
  next: WorkflowState;
  applicantEmail?: string;
  directory?: ApproverDirectory;
  store?: OutboxStore & { add(topic: string, payload: unknown): unknown };
}): Promise<number> {
  const store = params.store ?? notifyOutbox;
  const mails = buildTransitionMails({
    title: params.title,
    prev: params.prev,
    next: params.next,
    directory: params.directory ?? APPROVER_DIRECTORY,
    applicantEmail: params.applicantEmail,
  });
  // **1 宛先 = 1 エントリに分解してから積む。** `buildTransitionMails` は
  // 承認依頼で複数の承認者(部長承認など)を 1 通の `to` 配列にまとめて
  // 返す——これをそのまま Outbox に積むと、`mailerChannel().send()` が
  // `to` を配列のまま `mailer.sendMail` へ渡し、**受信者全員が互いの
  // メールアドレスを見られる**(`@platform/mail` の警告そのもの)。
  //
  // **Outbox のプロトコルは変えない。** 「1 メッセージ = 1 ペイロード」は
  // そのままで、ペイロードの `to` を単一文字列にするだけ——dedup の
  // キー生成(`JSON.stringify(msg.payload)`)も `relayOutbox` の挙動も
  // 影響を受けない。宛先ごとに別々のペイロードとして積むので、
  // 1 人への送信が失敗しても他の宛先の再試行を巻き込まない
  // (2026-08、確実配信の仕組みを壊さずに直した)。
  let count = 0;
  for (const mail of mails) {
    for (const to of mail.to) {
      // **email チャネルが無効な人には積まない。** ここは email 専用の
      // 経路なので、push 等の代替チャネルは持たない——「送らない」が
      // 意味を持つ場面(通知を止めている人)だけ判定する。
      const decision = await decideDelivery(preferenceStore, to, { category: "approval" });
      if (!hasChannel(decision, "email")) continue;
      store.add("expense.mail", { to, subject: mail.subject, text: mail.text } satisfies MailPayload);
      count++;
    }
  }
  return count;
}

/** mailer を NotifyChannel 形にするアダプタ(dedup と合成するため)。 */
function mailerChannel(): NotifyChannel {
  return {
    async send(message) {
      // NotifyMessage.text に JSON を載せて渡す簡易ブリッジ。
      // **壊れていたら恒久的な失敗として投げる。** 2026-08 まで `JSON.parse` を
      // 直接呼んでおり、例外がそのまま出ていた——`send` の失敗は
      // **Outbox が再試行する**契約なので、**壊れたものを永久に送り続ける**。
      // `VALIDATION` は `defaultShouldRetry` が再試行しないので、ここで止まる。
      let payload: MailPayload;
      try {
        payload = JSON.parse(message.text) as MailPayload;
      } catch {
        throw new AppError(ErrorCode.VALIDATION, "通知の本文を解析できません(再試行しても直りません)");
      }
      const res = await mailer.sendMail({ to: payload.to, subject: payload.subject, text: payload.text });
      if (!res.ok) throw new Error(res.error.message); // 失敗は throw → Outbox が再試行
    },
  };
}

/**
 * Outbox に積まれた通知メールをリレーする(cron/worker から定期実行)。
 * dedup で同一メールの二重送信を防ぎ、送信失敗は Outbox の指数バックオフで再試行される。
 * @returns 送信・失敗・打ち切りの件数
 */
export async function relayExpenseNotifications(options?: {
  store?: OutboxStore;
  seen?: SeenStore;
  channel?: NotifyChannel;
}): Promise<{ sent: number; failed: number; exhausted: number }> {
  const store = options?.store ?? notifyOutbox;
  const seen = options?.seen ?? notifySeen;
  const channel = options?.channel ?? mailerChannel();
  const DEDUP_TTL_MS = 10 * 60 * 1000; // 10分間は同一メールを抑制
  const result = await relayOutbox(store, async (msg) => {
    const key = JSON.stringify(msg.payload);
    // 既に配信済みの同一メールなら二重送信しない(スキップ=成功扱い)。
    if (seen.has(key)) {
      log.info({ key: key.slice(0, 40) }, "通知メールを重複としてスキップ");
      return;
    }
    // 未配信 → 送信。失敗時は throw され Outbox が再試行(dedup 記録は成功後なので再試行を塞がない)。
    await channel.send({ text: key });
    seen.markSeen(key, DEDUP_TTL_MS);
  });
  if (result.exhausted > 0) {
    log.warn({ exhausted: result.exhausted }, "通知メールが最大試行回数に達しました");
    // **メトリクスにも載せる。** 2026-08 まで**ログにしか残っておらず**、
    // 見る人がいなければ気づけなかった——`evaluateAndNotify` は
    // メトリクスを評価して通知するので、ここに載せて初めて**人に届く**。
    //
    // 経費の承認通知が届かないと、**承認が止まったまま誰も気づかない**
    // (申請者は「まだ承認されない」と思い、承認者は「依頼が来ていない」と思う)
    metrics.incrementCounter("outbox.exhausted", result.exhausted, { kind: "expense-notify" });
  }
  return result;
}

/**
 * 後方互換: 即時送信版(Outbox を介さず直接送る)。fire-and-forget 用途。
 * 確実性が必要な箇所では enqueue + relay を使うこと。
 */
export async function notifyExpenseTransition(params: {
  title: string;
  prev: WorkflowState;
  next: WorkflowState;
  applicantEmail?: string;
  directory?: ApproverDirectory;
}): Promise<void> {
  const mails = buildTransitionMails({
    title: params.title,
    prev: params.prev,
    next: params.next,
    directory: params.directory ?? APPROVER_DIRECTORY,
    applicantEmail: params.applicantEmail,
  });
  for (const mail of mails) {
    // **1 件ずつ送る。** `mail.to` は複数の承認者を含みうる配列——
    // そのまま渡すと受信者全員に他の宛先が見える(enqueue 側と同じ穴。
    // 2026-08 に修正)。
    for (const to of mail.to) {
      const res = await mailer.sendMail({ to, subject: mail.subject, text: mail.text });
      if (!res.ok) log.warn({ to, error: res.error.message }, "通知メールの送信に失敗しました");
    }
  }
}
