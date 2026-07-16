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

/**
 * 円表記にする。
 *
 * @param amount 金額
 * @returns `¥1,234` 形式(**桁区切りつき**。帳票では必須)
 */
export function formatYen(value: number): string {
  return `¥${Math.trunc(value).toLocaleString("ja-JP")}`;
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
