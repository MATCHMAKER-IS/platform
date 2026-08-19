/**
 * LINE Webhook の本文を**解析する**部分。
 *
 * 【なぜ署名の検証と分けているか】
 * 検証は `node:crypto`（HMAC）を使うので、**ブラウザや Edge では動きません**。
 * 一方この解析は**文字列を読むだけ**で、どこでも動きます。
 *
 * 同じファイルに置くと、**解析したいだけの画面が `node:crypto` を巻き込み**、
 * `next build` が落ちます（`UnhandledSchemeError`。2026-08）。
 * **「純粋かどうか」はファイル単位で決まります**——関数単位ではありません。
 *
 * 検証は `@platform/line` の `verifyLineSignature` を**サーバで**使ってください。
 *
 * @packageDocumentation
 */
/** イベント送信元(user/group/room)。 */
export interface LineEventSource {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
}

/** 受信イベントの共通部分。 */
export interface LineEventBase {
  type: string;
  timestamp: number;
  source: LineEventSource;
  /** message/postback 等で返信に使うトークン(follow など無い場合もある)。 */
  replyToken?: string;
}

/** メッセージ受信イベント。 */
export interface LineMessageEvent extends LineEventBase {
  type: "message";
  message: { id: string; type: string; text?: string; [key: string]: unknown };
}

/** ポストバックイベント(ボタン押下等)。 */
export interface LinePostbackEvent extends LineEventBase {
  type: "postback";
  postback: { data: string; params?: Record<string, string> };
}

/** フォロー/アンフォロー/参加/退出。 */
export interface LineSimpleEvent extends LineEventBase {
  type: "follow" | "unfollow" | "join" | "leave";
}

/** 受信イベントの判別可能ユニオン。 */
export type LineWebhookEvent = LineMessageEvent | LinePostbackEvent | LineSimpleEvent | LineEventBase;

/**
 * Webhook のボディを解析する。
 *
 * **署名の検証は別途行うこと**(この関数は解析するだけ)。
 *
 * @param body リクエストボディ
 * @returns イベントの配列。**解析できなければ空配列**
 */
export function parseLineWebhook(body: string): LineWebhookEvent[] {
  // **例外を投げない。** webhook の入口で throw すると 500 が返り、
  // LINE 側がリトライを繰り返す(壊れたボディは何度送っても壊れている)。
  // 空配列を返して 200 で受け、ログに残すのが正しい。
  try {
    const parsed = JSON.parse(body) as { events?: LineWebhookEvent[] } | null;
    if (parsed === null || typeof parsed !== "object") return [];
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

/**
 * ポストバックの data を解析する。
 *
 * **クエリ文字列形式**(`action=buy&id=123`)を想定。JSON より短く、
 * LINE の data は 300 文字までなので有利。
 *
 * @param data ポストバックの data
 * @returns キー → 値
 */
export function parsePostbackData(data: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of data.split("&")) {
    const idx = pair.indexOf("=");
    if (idx === -1) { if (pair) out[pair] = ""; continue; }
    out[decodeURIComponent(pair.slice(0, idx))] = decodeURIComponent(pair.slice(idx + 1));
  }
  return out;
}

/**
 * イベントから push 先の ID を取り出す。
 *
 * **返信(reply)とは別**。reply トークンは 1 回・短時間しか使えないので、
 * 後から送るなら push を使う(こちらは課金対象)。
 *
 * @param source イベント
 * @returns 宛先 ID。**取れなければ null**
 */
export function eventSourceId(source: LineEventSource): string | undefined {
  return source.userId ?? source.groupId ?? source.roomId;
}
