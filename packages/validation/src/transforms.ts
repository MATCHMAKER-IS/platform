/**
 * 入力の正規化ユーティリティ。全角数字→半角など、検証前の前処理に使う。
 * @packageDocumentation
 */

/**
 * 全角英数字・記号を半角へ変換する。
 *
 * @param input 変換する文字列
 * @returns 全角の英数記号を半角にした文字列(**カナは変換しない**)
 */
export function toHalfWidth(input: string): string {
  return input.replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

/**
 * 全角数字のみ半角へ変換する(電話番号・郵便番号の前処理向け)。
 *
 * @param input 変換する文字列
 * @returns 全角数字だけを半角にした文字列(他はそのまま)
 */
export function digitsToHalfWidth(input: string): string {
  return input.replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * 連続する空白を 1 つに畳み、前後をトリムする。
 *
 * @param input 変換する文字列
 * @returns 全角空白を半角に、連続する空白を 1 つに、前後を除去した文字列
 */
export function normalizeSpace(input: string): string {
  return input.replace(/[\s\u3000]+/g, " ").trim();
}
