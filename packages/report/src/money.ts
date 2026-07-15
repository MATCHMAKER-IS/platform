/**
 * 金額・端数処理ユーティリティ(純関数)。
 * @packageDocumentation
 */

/** 端数処理モード。 */
export type RoundingMode = "round" | "floor" | "ceil";

/** 指定モードで端数処理する。 */
export function roundAmount(value: number, mode: RoundingMode = "round"): number {
  if (mode === "floor") return Math.floor(value);
  if (mode === "ceil") return Math.ceil(value);
  return Math.round(value);
}

/** 円表記(¥1,234)にする。 */
export function formatYen(value: number): string {
  return `¥${Math.trunc(value).toLocaleString("ja-JP")}`;
}

/** 数量×単価などの掛け算(小数誤差を避けるため四捨五入で整数化しない=呼び出し側で端数処理)。 */
export function multiply(a: number, b: number): number {
  return Math.round(a * b * 1e6) / 1e6;
}
