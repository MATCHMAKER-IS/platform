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
        text: message.text,
        thread_ts: message.threadTs,
        blocks: message.blocks,
        reply_broadcast: message.replyBroadcast,
      });
      return { channel: r.channel ?? message.channel, ts: r.ts ?? "" };
    },

    async updateMessage({ channel, ts, text, blocks }) {
      await call("chat.update", { channel, ts, text, blocks });
    },

    async deleteMessage({ channel, ts }) {
      await call("chat.delete", { channel, ts });
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

/**
 * 承認・却下ボタン付きのメッセージ(Block Kit)を組み立てる。
 *
 * 承認をチャットで回すと速いが、**押した人が誰かを必ず確かめる**こと。
 * 押下時に届く payload の `userId` を、社内の利用者と突き合わせてから処理する。
 *
 * @param req 見出し・本文・ボタンに埋める値
 * @returns `postMessage` の `blocks` に渡す配列
 *
 * @example
 * ```ts
 * await slack.postMessage({
 *   channel: "#承認",
 *   text: "経費申請の承認",   // 通知欄に出る代替テキスト
 *   blocks: buildApprovalBlocks({ title: "経費申請の承認", summary: "山田太郎 / 12,000円", actionValue: "expense:123" }),
 * });
 * ```
 */
export function buildApprovalBlocks(req: ApprovalRequest): unknown[] {
  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: req.title, emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: req.summary } },
  ];
  if (req.fields && req.fields.length > 0) {
    blocks.push({
      type: "section",
      fields: req.fields.map((f) => ({ type: "mrkdwn", text: `*${f.label}*\n${f.value}` })),
    });
  }
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        style: "primary",
        text: { type: "plain_text", text: req.approveLabel ?? "承認する" },
        action_id: "approve",
        value: req.actionValue,
      },
      {
        type: "button",
        style: "danger",
        text: { type: "plain_text", text: req.rejectLabel ?? "却下する" },
        action_id: "reject",
        value: req.actionValue,
        // 誤操作を防ぐため、却下は確認を挟む
        confirm: {
          title: { type: "plain_text", text: "却下しますか" },
          text: { type: "mrkdwn", text: "この操作は申請者に通知されます。" },
          confirm: { type: "plain_text", text: "却下する" },
          deny: { type: "plain_text", text: "やめる" },
        },
      },
    ],
  });
  return blocks;
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

/**
 * ボタン押下の payload を解く。
 *
 * Slack は `application/x-www-form-urlencoded` の `payload=` に JSON を入れて送ってくる。
 * **署名の検証は別途必ず行うこと**(`verifySlackSignature`)。ここは形を整えるだけ。
 *
 * @param body 生ボディ
 * @returns 押されたボタンの情報。想定外の形なら null
 */
export function parseInteraction(body: string): SlackInteraction | null {
  const raw = new URLSearchParams(body).get("payload");
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as {
      actions?: { action_id?: string; value?: string }[];
      user?: { id?: string; username?: string; name?: string };
      channel?: { id?: string };
      message?: { ts?: string };
      response_url?: string;
    };
    const action = p.actions?.[0];
    if (!action?.action_id) return null;
    return {
      actionId: action.action_id,
      value: action.value ?? "",
      userId: p.user?.id ?? "",
      userName: p.user?.username ?? p.user?.name ?? "",
      channelId: p.channel?.id ?? "",
      messageTs: p.message?.ts ?? "",
      responseUrl: p.response_url ?? "",
    };
  } catch {
    return null;
  }
}
