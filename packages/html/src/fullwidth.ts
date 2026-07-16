/**
 * 全角⇔半角の変換（英数字・記号・スペース）。すべて純関数。
 * @packageDocumentation
 */

/**
 * 全角の英数字・記号・スペースを半角にする。
 *
 * **人が手入力した値を扱う前に通す**。日本語 IME は全角のまま英数字を打ってしまうため、
 * 検索や照合が一致しなくなる。**カタカナは変換しない**。
 *
 * @param input 対象の文字列
 * @returns 半角にした文字列
 */
export function zenkakuToHankaku(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, " ");
}

/**
 * 半角の英数字・記号・スペースを全角にする。
 *
 * **使う場面は限られる**(帳票の見た目を揃える・全角必須の外部システムへ送る、など)。
 *
 * @param input 対象の文字列
 * @returns 全角にした文字列
 */
export function hankakuToZenkaku(input: string): string {
  return input
    .replace(/[\u0021-\u007E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0))
    .replace(/ /g, "\u3000");
}

/**
 * 全角数字だけを半角にする(電話番号・金額の正規化用)。
 *
 * **英字や記号は変えたくない**ときに使う。
 *
 * @param input 対象の文字列
 * @returns 数字だけ半角にした文字列
 */
export function zenkakuDigitsToHankaku(input: string): string {
  return input.replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}
