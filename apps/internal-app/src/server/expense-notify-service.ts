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

/** 承認者ディレクトリ(実運用では DB や設定から取得)。 */
export const APPROVER_DIRECTORY: ApproverDirectory = {
  manager: [{ name: "課長", email: "manager@example.co.jp" }],
  director: [{ name: "部長", email: "director@example.co.jp" }],
};

/** Outbox に積むメール1通のペイロード。 */
interface MailPayload { to: string[]; subject: string; text: string }

/**
 * 遷移に応じた通知メールを Outbox に積む(確実配信の起点)。
 * 実運用では承認の DB 更新と同一トランザクションで add することで、コミットと通知の整合を取る。
 */
export function enqueueExpenseTransition(params: {
  title: string;
  prev: WorkflowState;
  next: WorkflowState;
  applicantEmail?: string;
  directory?: ApproverDirectory;
  store?: OutboxStore & { add(topic: string, payload: unknown): unknown };
}): number {
  const store = params.store ?? notifyOutbox;
  const mails = buildTransitionMails({
    title: params.title,
    prev: params.prev,
    next: params.next,
    directory: params.directory ?? APPROVER_DIRECTORY,
    applicantEmail: params.applicantEmail,
  });
  for (const mail of mails) store.add("expense.mail", mail satisfies MailPayload);
  return mails.length;
}

/** mailer を NotifyChannel 形にするアダプタ(dedup と合成するため)。 */
function mailerChannel(): NotifyChannel {
  return {
    async send(message) {
      // NotifyMessage.text に JSON を載せて渡す簡易ブリッジ
      const payload = JSON.parse(message.text) as MailPayload;
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
  if (result.exhausted > 0) log.warn({ exhausted: result.exhausted }, "通知メールが最大試行回数に達しました");
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
    const res = await mailer.sendMail({ to: mail.to, subject: mail.subject, text: mail.text });
    if (!res.ok) log.warn({ to: mail.to, error: res.error.message }, "通知メールの送信に失敗しました");
  }
}
