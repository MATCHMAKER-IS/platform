/**
 * 金額・端数処理ユーティリティ(純関数)。
 * @packageDocumentation
 */

/** 端数処理モード。 */
export type RoundingMode = "round" | "floor" | "ceil";

/**
 * 指定したモードで端数処理する。
 *
 * **帳票は端数処理の方針を統一しないと、明細の合計と総額が 1 円ずれる**。
 * 税額の計算そのものは `@platform/tax` の担当(方針が一元管理されている)。
 *
 * @param value 処理する値
 * @param mode `floor`(切り捨て)/ `round`(四捨五入)/ `ceil`(切り上げ)
 * @returns 整数に丸めた値
 */
export function roundAmount(value: number, mode: RoundingMode = "round"): number {
  if (mode === "floor") return Math.floor(value);
  if (mode === "ceil") return Math.ceil(value);
  return Math.round(value);
}

/** 負の金額の書き方。 */
export type NegativeStyle =
  /** `-¥5,000`。記号の前に符号を置く(既定)。 */
  | "sign"
  /** `△5,000`。**日本の会計帳票の慣行**。決算書・試算表はこちら。 */
  | "triangle"
  /** `(¥5,000)`。英文会計。海外向けの資料で使う。 */
  | "paren";

/**
 * 円表記にする。
 *
 * **負の金額に `¥-5,000` と書かない。** 2026-08 まで単純に記号を前置しており、
 * 還付・返金・差額をそのまま出すと `¥-5,000` になっていた。
 * 日本の会計帳票では `△5,000`、一般的な画面では `-¥5,000` と書く。
 * `packages/accounting` は消費税の還付(マイナス)を扱うので、実際に出る値。
 *
 * **端数は切り捨てる**(`Math.trunc`)。四捨五入したいなら先に
 * {@link roundAmount} を通すこと——ここで丸めると、
 * 明細ごとに丸めた合計が総額と合わなくなる。
 *
 * @param value 金額
 * @param negative 負の値の書き方(既定 `sign` = `-¥5,000`)
 * @returns 桁区切り付きの円表記
 *
 * @example
 * ```ts
 * formatYen(1234567);              // "¥1,234,567"
 * formatYen(-5000);                // "-¥5,000"
 * formatYen(-5000, "triangle");    // "△5,000"  (決算書・試算表)
 * formatYen(-5000, "paren");       // "(¥5,000)" (英文会計)
 * ```
 */
export function formatYen(value: number, negative: NegativeStyle = "sign"): string {
  const n = Math.trunc(value);
  const body = Math.abs(n).toLocaleString("ja-JP");
  if (n >= 0) return `¥${body}`;
  if (negative === "triangle") return `△${body}`;
  if (negative === "paren") return `(¥${body})`;
  return `-¥${body}`;
}

/**
 * 数量 × 単価などの掛け算を行う。
 *
 * **ここでは端数処理しない**。明細ごとに丸めると、合計が総額と合わなくなる。
 * 丸めるのは最後の 1 回だけにする(呼び出し側で {@link roundMoney} を通す)。
 *
 * @param a 数量など
 * @param b 単価など
 * @returns 積(**小数のまま**)
 */
export function multiply(a: number, b: number): number {
  return Math.round(a * b * 1e6) / 1e6;
}
