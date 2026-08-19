/**
 * eKYC ベンダーからの判定 Webhook の署名検証とパース。
 * ベンダーにより署名方式(HMAC hex/base64)が異なるため設定可能。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";
// **解析は `./webhook-parse` に分けてある。** 画面から使うときは
// `@platform/ekyc/webhook-parse` を直接取ること（ここは node:crypto を巻き込む）
export { parseEkycWebhook, type EkycWebhookEvent } from "./webhook-parse";

/**
 * Webhook 署名を検証する。
 * @param body リクエストの生ボディ(パース前)
 * @param signature 署名ヘッダ値
 * @param secret 署名シークレット
 * @param encoding 署名のエンコード("hex" | "base64"。既定 "hex")
 * @returns 署名が正当なら true。**必ず検証すること**(本人確認の結果を偽装されると、なりすましを許す)
 */
export function verifyEkycSignature(body: string, signature: string, secret: string, encoding: "hex" | "base64" = "hex"): boolean {
  const expected = createHmac("sha256", secret).update(body).digest(encoding);
  if (signature.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
