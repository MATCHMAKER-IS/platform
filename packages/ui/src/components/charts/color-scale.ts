/**
 * 数値→色 の線形スケール(ヒートマップ用、純関数)。
 * @packageDocumentation
 */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * 2 色を t(0〜1)で線形補間する。
 *
 *
 * @param from 開始色
 * @param to 終了色
 * @param t 進捗(0–1)
 * @returns 補間した色
 */
export function interpolateColor(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
}

/**
 * value を [min,max] で正規化し、from→to の色に写像する。
 *
 *
 * @param colors 色の配列(**2 色以上**)
 * @param t 位置(0–1)
 * @returns その位置の色(**多段のグラデーション**。ヒートマップなどに使う)
 */
export function colorScale(value: number, min: number, max: number, from = "#e0f2f1", to = "#0d9488"): string {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  return interpolateColor(from, to, t);
}
