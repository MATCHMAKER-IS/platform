/**
 * LINE の宛先 ID の判定。
 *
 * **依存を持ちません。** 束ねた入口（`index.ts`）は Webhook の署名検証を
 * 通じて `node:crypto` に届くので、**画面から宛先の判定だけしたいとき**は
 * `@platform/line/recipient` を使ってください。
 *
 * @packageDocumentation
 */
/** LINE 宛先の種別。 */
export type LineRecipientType = "user" | "group" | "room" | "unknown";

/**
 * LINE の宛先 ID から種別を判定する。
 *
 * **接頭辞で分かる**(`U` = ユーザー、`C` = グループ、`R` = ルーム)。
 * 種別で使える API が違うので、送る前に確認する。
 *
 * @param id 宛先 ID
 * @returns 種別。**判定できなければ `"unknown"`**（null は返りません）
 */
export function lineRecipientType(id: string): LineRecipientType {
  if (/^U[0-9a-f]{32}$/i.test(id)) return "user";
  if (/^C[0-9a-f]{32}$/i.test(id)) return "group";
  if (/^R[0-9a-f]{32}$/i.test(id)) return "room";
  return "unknown";
}

/**
 * LINE の宛先 ID として妥当かを判定する。
 *
 * @param id 宛先 ID
 * @returns 妥当なら true
 */
export function isValidLineRecipient(id: string): boolean {
  return lineRecipientType(id) !== "unknown";
}
