/**
 * 郵便番号ユーティリティ(既存の日本固有バリデーションを補完)。
 * かな判定・法人番号・マイナンバー・全角半角変換は既存の `./japan.js` / `./transforms.js` を参照。
 * @packageDocumentation
 */
import { toHalfWidth } from "./transforms.js";

/**
 * 郵便番号(7桁 or "123-4567")として妥当か。
 *
 * @param input 郵便番号(ハイフンあり・なしどちらでも)
 * @returns 7 桁の数字なら true
 */
export function isValidPostalCode(input: string): boolean {
  const s = toHalfWidth(input).trim();
  return /^\d{3}-?\d{4}$/.test(s);
}

/**
 * 郵便番号を "123-4567" に整形する。不正なら null。
 *
 * @param input 郵便番号
 * @returns `123-4567` 形式。不正なら入力をそのまま返す
 */
export function formatPostalCode(input: string): string | null {
  const digits = toHalfWidth(input).replace(/[^\d]/g, "");
  if (digits.length !== 7) return null;
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}
