/**
 * 数値の日本語表記(漢数字・大字)。請求書・契約書の金額表記に。
 * @packageDocumentation
 */

const DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"] as const;
const DIGITS_DAIJI = ["", "壱", "弐", "参", "四", "五", "六", "七", "八", "九"] as const;
const SMALL_UNITS = ["", "十", "百", "千"] as const;
const SMALL_UNITS_DAIJI = ["", "拾", "百", "千"] as const;
const BIG_UNITS = ["", "万", "億", "兆", "京"] as const;

interface Style { digits: readonly string[]; smallUnits: readonly string[] }

/** 0〜9999 を漢数字にする(内部用)。 */
function fourDigits(n: number, style: Style): string {
  let out = "";
  const s = String(n).padStart(4, "0");
  for (let i = 0; i < 4; i++) {
    const d = Number(s[i]);
    const unitIndex = 3 - i;
    if (d === 0) continue;
    // 十/百/千の位で 1 は「一」を省略(通常表記)。大字では壱拾等を出すため digits を使う。
    const digitStr = d === 1 && unitIndex > 0 && style.digits === DIGITS ? "" : (style.digits[d] ?? "");
    out += digitStr + (style.smallUnits[unitIndex] ?? "");
  }
  return out;
}

/**
 * 整数を漢数字にする。
 *
 * @param n 整数(**負数・0 も扱える**)
 * @returns 漢数字の文字列
 *
 * @example
 * ```ts
 * toKanjiNumber(12345);  // => "一万二千三百四十五"
 * ```
 */
export function toKanjiNumber(value: number, options: { daiji?: boolean } = {}): string {
  if (!Number.isFinite(value)) return "";
  const daiji = options.daiji ?? false;
  const style: Style = daiji ? { digits: DIGITS_DAIJI, smallUnits: SMALL_UNITS_DAIJI } : { digits: DIGITS, smallUnits: SMALL_UNITS };
  const n = Math.trunc(Math.abs(value));
  if (n === 0) return daiji ? "零" : "〇";

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) { groups.push(rest % 10000); rest = Math.floor(rest / 10000); }

  let out = "";
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i] as number;
    if (g === 0) continue;
    out += fourDigits(g, style) + BIG_UNITS[i];
  }
  return (value < 0 ? (daiji ? "マイナス" : "マイナス") : "") + out;
}

/**
 * 金額を大字(だいじ)の証書表記にする。
 *
 * **契約書・領収書で改ざんを防ぐため**の表記(「一」に線を足して「二」にできない)。
 * 法的な文書で求められることがある。
 *
 * @param amount 金額(円)
 * @returns 「金壱萬弐千参百四拾五円」形式
 */
export function toDaijiAmount(value: number, options: { withPrefix?: boolean; withSuffix?: boolean } = {}): string {
  const { withPrefix = true, withSuffix = true } = options;
  // 大字の証書慣行では「万」も「萬」を用いることが多い。
  const body = toKanjiNumber(value, { daiji: true }).replace(/万/g, "萬");
  return `${withPrefix ? "金" : ""}${body}${withSuffix ? "円" : ""}`;
}
