/**
 * 全角⇔半角の変換（英数字・記号・スペース）。すべて純関数。
 * @packageDocumentation
 */

/** 全角の英数字・記号・スペースを半角にする。 */
export function zenkakuToHankaku(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

/** 半角の英数字・記号・スペースを全角にする。 */
export function hankakuToZenkaku(input: string): string {
  return input
    .replace(/[\u0021-\u007E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0))
    .replace(/ /g, "\u3000");
}

/** 全角数字だけを半角にする（電話番号・金額の正規化用）。 */
export function zenkakuDigitsToHankaku(input: string): string {
  return input.replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}
