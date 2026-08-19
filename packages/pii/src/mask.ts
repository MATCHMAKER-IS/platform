/**
 * 個人情報の**伏せ字**。
 *
 * 【なぜ独立したファイルにしているか】
 * 束ねた入口（`index.ts`）は `blindIndex` のために **`node:crypto` を使います**。
 * 画面で伏せ字を出したいだけなのに入口から取ると、
 * **Edge やブラウザ向けのビルドが落ちます**（`UnhandledSchemeError`）
 * ——`showcase` の画面が実際にそうなっていました（2026-08）。
 *
 * ここにあるのは**依存を持たない関数だけ**なので、どこからでも呼べます。
 *
 * @packageDocumentation
 */

/**
 * メールアドレスをマスクする。
 *
 * **ドメインは残す**(社内か社外かは調査に役立つ)。全部隠すと本人確認ができない。
 *
 * @param email メールアドレス
 * @returns マスクしたアドレス。**@ が無ければ全体をマスク**(不正な形式でも漏らさない)
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const head = local[0] ?? "";
  return `${head}***${domain}`;
}

/**
 * 電話番号をマスクする(**末尾 4 桁のみ残す**)。
 *
 * 「自分の番号だ」と分かる最小限。全部隠すと本人確認に使えない。
 *
 * @param phone 電話番号
 * @returns マスクした番号
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length);
  return "*".repeat(digits.length - 4) + digits.slice(-4);
}

/**
 * 氏名をマスクする(**先頭 1 文字 + 伏字**)。
 *
 * @param name 氏名
 * @returns マスクした氏名
 */
export function maskName(name: string): string {
  if (name.length === 0) return "";
  return `${name[0]}***`;
}

/**
 * 任意の文字列を部分マスクする。
 *
 * @param value 対象の文字列
 * @param visibleHead 先頭に残す文字数
 * @returns マスクした文字列。**残す文字数が元の長さ以上なら全マスク**(安全側)
 */
export function maskPartial(value: string, visibleHead = 1): string {
  if (value.length <= visibleHead) return "*".repeat(value.length);
  return value.slice(0, visibleHead) + "*".repeat(Math.max(3, value.length - visibleHead));
}
