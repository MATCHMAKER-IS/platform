/**
 * `@platform/slack` — Slack Web API と受信(イベント/スラッシュコマンド)。
 *
 * **一方向に通知を送るだけなら `@platform/notify` の `createSlackChannel` で足りる**
 * (Incoming Webhook)。こちらは、それでは足りない場合のためのもの:
 *   - スレッドに返信する / メッセージを更新・削除する
 *   - 利用者やチャンネルを引く
 *   - Slack からの**受信**(イベント・スラッシュコマンド)を検証する
 *
 * 受信で最も大事なのは**署名の検証**。URL さえ分かれば誰でも偽の通知を送れるため、
 * 検証していない受信口は「社内システムを外部から操作できる穴」になる。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";

// **ブラウザからも使う部分は別ファイル。** 画面からは `/strength` `/blocks` を直接取ること
export { buildApprovalBlocks, parseInteraction } from "./blocks";

const API = "https://slack.com/api";

/** 投稿するメッセージ。 */
export interface SlackMessage {
  /** 投稿先(チャンネル ID or `#名前`)。 */
  channel: string;
  text: string;
  /** スレッドに返信する場合、親メッセージの ts。 */
  threadTs?: string;
  /** Block Kit の構造(整形した表示にしたいとき)。 */
  blocks?: unknown[];
  /** スレッド内の投稿をチャンネルにも出すか。 */
  replyBroadcast?: boolean;
}

/** 投稿結果。`ts` はスレッド返信や更新に使う。 */
export interface SlackPostResult {
  channel: string;
  ts: string;
}

/** Slack の利用者。 */
export interface SlackUser {
  id: string;
  name: string;
  realName?: string;
  email?: string;
  isBot: boolean;
}

/** Slack クライアント。 */
export interface SlackClient {
  /** 任意の Web API を叩く(未対応のメソッド用)。 */
  call<T>(method: string, body?: Record<string, unknown>): Promise<T>;
  postMessage(message: SlackMessage): Promise<SlackPostResult>;
  updateMessage(params: { channel: string; ts: string; text: string; blocks?: unknown[] }): Promise<void>;
  deleteMessage(params: { channel: string; ts: string }): Promise<void>;
  /** メールアドレスから利用者を引く(社内の名寄せに使う)。 */
  /**
   * ファイルを送る（**帳票・請求書の共有**に）。
   *
   * **3 段階で送ります**——途中で止まると
   * **送ったつもりなのに誰にも見えない**状態になるので、
   * 例外を握りつぶさないでください。
   *
   * **スレッドに付けるなら `threadTs`** を渡してください。
   * 付けないと**関係ない場所に単独で出て、何の資料か分からなくなります**。
   */
  uploadFile(input: {
    channel: string;
    filename: string;
    content: Uint8Array;
    title?: string;
    comment?: string;
    threadTs?: string;
  }): Promise<{ fileId: string }>;

  /**
   * リアクションを付ける（**「見ました」の静かな合図**）。
   *
   * 返信すると通知が飛びますが、リアクションなら**静かに伝わります**。
   *
   * @param input `emoji` は `:` を付けずに（`white_check_mark` など）
   */
  addReaction(input: { channel: string; ts: string; emoji: string }): Promise<void>;

  /**
   * **その人にだけ見える投稿**（他の人には残りません）。
   *
   * 「あなたの経費 3 件が差し戻されています」のような
   * **個人あての知らせ**に使ってください。
   *
   * **記録には残りません**（あとから遡れない）ので、
   * **監査が要るものには使わないでください**。
   */
  postEphemeral(message: {
    channel: string;
    user: string;
    text: string;
    blocks?: unknown[];
    threadTs?: string;
  }): Promise<{ ts: string }>;

  lookupUserByEmail(email: string): Promise<SlackUser | null>;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  channel?: string;
  ts?: string;
  user?: { id: string; name: string; real_name?: string; is_bot?: boolean; profile?: { email?: string } };
}

/**
 * Slack クライアントを作る。
 *
 * Slack の Web API は**失敗しても HTTP 200 を返し、本文の `ok` が false になる**。
 * ステータスだけ見ていると失敗に気づけないため、ここで本文まで確認する。
 *
 * @param token    ボットトークン(`xoxb-` で始まる)
 * @param fetchImpl テスト用に差し替え可能
 * @returns Slack クライアント
 * @throws Error API が失敗したとき(HTTP 200 でも本文の ok が false なら失敗)
 *
 * @example
 * ```ts
 * const slack = createSlackClient(process.env.SLACK_BOT_TOKEN);
 * const posted = await slack.postMessage({ channel: "#経理", text: "月次締めを開始します" });
 * await slack.postMessage({ channel: posted.channel, threadTs: posted.ts, text: "完了しました" });
 * ```
 */
/**
 * Slack の投稿本文の上限(文字)。
 *
 * **超えると投稿されない**(エラーが返る)。スタックトレースや SQL、
 * JSON の全文を貼ると簡単に超える——**通知が届かないまま気づかない**のが最も困る。
 */
export const SLACK_TEXT_LIMIT = 40000;

/**
 * Slack の上限に収める。
 *
 * **切り詰めたことが分かるようにする。** 黙って切ると、読む人は
 * 「これで全部」と思ってしまう——障害通知では**肝心な部分が落ちているのに
 * 気づけない**。末尾に省略の印を付ける(2026-08 に追加)。
 *
 * @param text 投稿する本文
 * @returns 上限に収めた本文
 */
export function truncateSlackText(text: string): string {
  if (text.length <= SLACK_TEXT_LIMIT) return text;
  const mark = `\n…(以下 ${text.length - SLACK_TEXT_LIMIT + 40} 文字を省略)`;
  return text.slice(0, SLACK_TEXT_LIMIT - mark.length) + mark;
}

/**
 * Slack へ通知を送る器を作る。
 *
 * **Incoming Webhook の URL は秘密です。** 漏れると**誰でもその部屋に投稿できます**
 * ——`.env` に置き、**コードに直接書かないでください**。
 *
 * **何でも通知すると、通知を見なくなります。**
 * 「**これが 1 件出たら誰かが動くか**」で送るかを決めてください
 * ——動かないなら**メトリクスに留める**方が有効です。
 *
 * @param token Bot トークン（**`webhookUrl` ではありません**。2026-08 まで別物の説明が付いていました）
 * @param fetchImpl 差し替え用（試験で作り物を渡す）
 * @returns 送信する器
 * @throws `webhookUrl` が空の場合
 */
export function createSlackClient(token: string, fetchImpl?: typeof fetch): SlackClient {
  const doFetch = fetchImpl ?? fetch;

  async function call<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
    const res = await doFetch(`${API}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as SlackApiResponse;
    // HTTP は 200 でも ok:false のことがある。ここを見ないと失敗を握りつぶす
    if (!json.ok) throw new Error(`Slack ${method} が失敗しました: ${json.error ?? "unknown"}`);
    return json as T;
  }

  return {
    call,

    async postMessage(message) {
      const r = await call<SlackApiResponse>("chat.postMessage", {
        channel: message.channel,
        text: truncateSlackText(message.text),
        thread_ts: message.threadTs,
        blocks: message.blocks,
        reply_broadcast: message.replyBroadcast,
      });
      return { channel: r.channel ?? message.channel, ts: r.ts ?? "" };
    },

    async updateMessage({ channel, ts, text, blocks }) {
      text = truncateSlackText(text);
      await call("chat.update", { channel, ts, text, blocks });
    },

    async deleteMessage({ channel, ts }) {
      await call("chat.delete", { channel, ts });
    },

    async uploadFile(input) {
      // **Slack のファイル送信は 3 段階**です（2024 年に方式が変わりました）:
      //   ① 送り先の URL をもらう ② そこへ実体を送る ③ 完了を伝える
      //
      // **1 回で送れないのは、Slack 側が大きいファイルを直接受けないため**です。
      // **③まで通って初めて成功**——途中で止まると、
      // **送ったつもりなのに誰にも見えない**状態になります。
      const bytes = input.content;
      const upload = await call<{ upload_url?: string; file_id?: string }>(
        "files.getUploadURLExternal",
        { filename: input.filename, length: String(bytes.byteLength) },
      );
      if (upload.upload_url === undefined || upload.file_id === undefined) {
        throw new Error("Slack: アップロード先の URL を取得できませんでした");
      }

      // ②実体を送る。**ここは Slack の API ではない**ので `call` は使いません
      // **`as BodyInit`。** TypeScript が `Uint8Array` をジェネリック化して
      // 以降、`BodyInit` との構造的な適合が崩れることがある——
      // `packages/microsoft/src/graph.ts`・`packages/line/src/index.ts` と
      // 同じ対処(2026-08、ユーザー環境での `pnpm -r typecheck` の
      // 延長で同種箇所を予防的に点検して発見)。
      const put = await doFetch(upload.upload_url, { method: "POST", body: bytes as BodyInit });
      if (!put.ok) throw new Error(`Slack: ファイルの送信に失敗しました（${put.status}）`);

      // ③完了を伝える。**これを忘れると、送ったのに誰にも見えません**
      const done = await call<{ files?: { id?: string }[] }>("files.completeUploadExternal", {
        files: [{ id: upload.file_id, title: input.title ?? input.filename }],
        channel_id: input.channel,
        // **スレッドに付ける**なら親の ts を渡す。付けないと
        // **関係ない場所に単独で出て、何の資料か分からなくなります**
        thread_ts: input.threadTs,
        initial_comment: input.comment,
      });
      return { fileId: done.files?.[0]?.id ?? upload.file_id };
    },

    async addReaction(input) {
      // **「見ました」の合図。** 返信すると通知が飛びますが、
      // リアクションなら**静かに伝わります**——
      // 承認待ちの一覧で「誰が確認済みか」を示すのに向きます。
      await call<SlackApiResponse>("reactions.add", {
        channel: input.channel,
        timestamp: input.ts,
        name: input.emoji,
      });
    },

    async postEphemeral(message) {
      // **その人にだけ見える投稿。** 他の人には残りません。
      //
      // **承認の確認や個人の数字**に使ってください——
      // 「あなたの経費 3 件が差し戻されています」を全員に見せる必要はありません。
      //
      // **記録には残りません**（あとから遡れない）ので、
      // **監査が要るものには使わないでください**。
      const r = await call<SlackApiResponse>("chat.postEphemeral", {
        channel: message.channel,
        user: message.user,
        text: truncateSlackText(message.text),
        blocks: message.blocks,
        thread_ts: message.threadTs,
      });
      return { ts: r.ts ?? "" };
    },

    async lookupUserByEmail(email) {
      try {
        const r = await call<SlackApiResponse>("users.lookupByEmail", { email });
        if (!r.user) return null;
        return {
          id: r.user.id,
          name: r.user.name,
          realName: r.user.real_name,
          email: r.user.profile?.email,
          isBot: r.user.is_bot ?? false,
        };
      } catch (e) {
        // 「見つからない」は異常ではないので null を返す
        if (e instanceof Error && e.message.includes("users_not_found")) return null;
        throw e;
      }
    },
  };
}

/** 署名検証の入力。 */
export interface SlackSignatureInput {
  /** リクエストの**生ボディ**(パース前の文字列)。 */
  body: string;
  /** `X-Slack-Signature` ヘッダ。 */
  signature: string;
  /** `X-Slack-Request-Timestamp` ヘッダ(秒)。 */
  timestamp: string;
  /** アプリの Signing Secret。 */
  signingSecret: string;
  /** 許容する時刻のずれ(秒。既定 300 = 5 分)。 */
  toleranceSeconds?: number;
  /** 現在時刻(秒。テスト用)。 */
  now?: () => number;
}

/**
 * Slack からの受信が本物かを検証する。
 *
 * **必ず生ボディで検証する。** JSON にパースしてから文字列へ戻すと、
 * 空白や順序が変わって一致しなくなる。
 *
 * 時刻を含めて署名するため、**古い要求の使い回し(リプレイ)も弾ける**。
 *
 * @param input 生ボディ・署名・時刻・秘密
 * @returns 本物なら true
 */
export function verifySlackSignature(input: SlackSignatureInput): boolean {
  const now = input.now ?? (() => Math.floor(Date.now() / 1000));
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) return false;

  const tolerance = input.toleranceSeconds ?? 300;
  if (Math.abs(now() - ts) > tolerance) return false;

  const expected = `v0=${createHmac("sha256", input.signingSecret).update(`v0:${input.timestamp}:${input.body}`).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** スラッシュコマンドの内容(`application/x-www-form-urlencoded` を解いたもの)。 */
export interface SlackSlashCommand {
  command: string;
  text: string;
  userId: string;
  userName: string;
  channelId: string;
  channelName: string;
  teamId: string;
  responseUrl: string;
}

/**
 * スラッシュコマンドの生ボディを解く。
 *
 * @param body 生ボディ(`command=/deploy&text=...` の形)
 * @returns 解いた内容
 */
export function parseSlashCommand(body: string): SlackSlashCommand {
  const p = new URLSearchParams(body);
  return {
    command: p.get("command") ?? "",
    text: p.get("text") ?? "",
    userId: p.get("user_id") ?? "",
    userName: p.get("user_name") ?? "",
    channelId: p.get("channel_id") ?? "",
    channelName: p.get("channel_name") ?? "",
    teamId: p.get("team_id") ?? "",
    responseUrl: p.get("response_url") ?? "",
  };
}

/* ------------------------------------------------------------------ *
 * Block Kit（見やすい通知・承認ボタン）
 * ------------------------------------------------------------------ */

/** 承認・却下ボタン付き通知の内容。 */
export interface ApprovalRequest {
  /** 見出し(例: "経費申請の承認")。 */
  title: string;
  /** 本文(誰が・何を・いくら など)。 */
  summary: string;
  /** 明細(ラベルと値。金額や日付を並べる)。 */
  fields?: { label: string; value: string }[];
  /** ボタンに埋め込む値。押されたときに戻ってくる(例: "expense:123")。 */
  actionValue: string;
  /** 承認ボタンの文言(既定 "承認する")。 */
  approveLabel?: string;
  /** 却下ボタンの文言(既定 "却下する")。 */
  rejectLabel?: string;
}

/** ボタンが押されたときに届く内容。 */
export interface SlackInteraction {
  /** 押されたボタンの action_id(例: "approve")。 */
  actionId: string;
  /** ボタンに埋めた値(例: "expense:123")。 */
  value: string;
  /** 押した人。**この人が権限を持つかを必ず確かめる**。 */
  userId: string;
  userName: string;
  channelId: string;
  /** 元メッセージの ts(更新して「承認済み」に差し替えるときに使う)。 */
  messageTs: string;
  /** 一時的な応答先 URL(30 分有効)。 */
  responseUrl: string;
}

