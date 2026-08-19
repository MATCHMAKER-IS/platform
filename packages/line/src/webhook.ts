/**
 * LINE Webhook の署名検証とイベントパース。
 * LINE は `x-line-signature` に「本文の HMAC-SHA256 を base64 した値」を送る(hex ではない)。
 * 汎用の @platform/webhook は hex 前提のため、LINE 専用にここで検証する。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * LINE Webhook の署名を検証する。
 * @param body    リクエストの生ボディ(パース前の文字列)
 * @param signature `x-line-signature` ヘッダ値(base64)
 * @param channelSecret チャネルシークレット
 * @returns 署名が正当なら true。**必ず検証すること**(しないと誰でも偽のイベントを送れる)
 */
export function verifyLineSignature(body: string, signature: string, channelSecret: string): boolean {
  const expected = createHmac("sha256", channelSecret).update(body).digest("base64");
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// **解析は `./webhook-parse` に分けてある。** 画面から使うときは
// `@platform/line/webhook-parse` を直接取ること（ここは node:crypto を巻き込む）
export {
  parseLineWebhook, parsePostbackData, eventSourceId,
  type LineEventSource, type LineEventBase, type LineMessageEvent,
  type LinePostbackEvent, type LineSimpleEvent, type LineWebhookEvent,
} from "./webhook-parse";
