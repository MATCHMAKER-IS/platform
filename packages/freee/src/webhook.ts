/**
 * freee Webhook の署名検証。freee は Webhook 本文の HMAC-SHA256(hex)を送る。
 * アプリ登録時に発行される署名シークレットで検証する。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * freee Webhook の署名を検証する。
 *
 * **署名だけではリプレイを防げない。** 署名が正しい要求は**何度でも送り直せる**
 * ——通信路を見られる立場(社内の中間装置・ログ・プロキシ)なら、
 * **署名を破らなくても「入金があった」通知を再送できる**。結果は**二重計上**。
 *
 * **受信側で冪等処理を入れること。** `@platform/webhook` の
 * `createMemoryWebhookStore`(または Redis 実装)にイベント ID を記録し、
 * **2 回目は処理せず 200 を返す**。
 *
 * freee は署名に時刻を含めないので、**時刻での検証はできない**
 * (`@platform/webhook` の `verifySignedAt` が使えるのは Stripe 形式のみ)。
 * イベント ID による重複排除が唯一の防御になる(2026-08 に明記)。
 *
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
  // **壊れた JSON でも例外を投げない。** 2026-08 まで `JSON.parse` を
  // 直接呼んでおり、説明の「解析できなければ空配列」と食い違っていた。
  // 例外が出ると経路が 500 を返し、**freee がリトライし続ける**——
  // 壊れたボディは何度送っても壊れているので、止まらない。
  let parsed: { application_notifications?: FreeeWebhookEvent[]; notifications?: FreeeWebhookEvent[] };
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    return [];
  }
  // **配列でなければ空を返す**(`{"notifications": "x"}` のような形で
  // 後段が落ちるのを防ぐ)
  const events = parsed?.application_notifications ?? parsed?.notifications;
  return Array.isArray(events) ? events : [];
}
