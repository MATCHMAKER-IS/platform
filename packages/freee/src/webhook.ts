/**
 * freee Webhook の署名検証。freee は Webhook 本文の HMAC-SHA256(hex)を送る。
 * アプリ登録時に発行される署名シークレットで検証する。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * freee Webhook の署名を検証する。
 * @param body      リクエストの生ボディ(パース前の文字列)
 * @param signature 署名ヘッダの値(hex)
 * @param secret    Webhook 署名シークレット
 * @returns 署名が正当なら true。**必ず検証すること**(しないと誰でも偽の通知を送れる)
 */
export function verifyFreeeSignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

/** freee Webhook 通知イベント。 */
export interface FreeeWebhookEvent {
  /** 通知の種類(例 "deal.created")。 */
  type: string;
  companyId?: number;
  /** 対象リソースの ID 等(freee のペイロード構造に依存)。 */
  [key: string]: unknown;
}

/**
 * Webhook のボディを解析してイベントを返す。
 *
 * **署名の検証は別途行うこと**(この関数はパースするだけ)。
 * 検証せずに処理すると、誰でも偽の通知を送れる。
 *
 * @param body リクエストボディ
 * @returns イベントの配列。**解析できなければ空配列**
 */
export function parseFreeeWebhook(body: string): FreeeWebhookEvent[] {
  const parsed = JSON.parse(body) as { application_notifications?: FreeeWebhookEvent[]; notifications?: FreeeWebhookEvent[] };
  return parsed.application_notifications ?? parsed.notifications ?? [];
}
