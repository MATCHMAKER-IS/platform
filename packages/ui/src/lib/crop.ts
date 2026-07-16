/**
 * トリミングの座標計算(純関数)。ドラッグの2点→矩形、表示px→自然px 変換。
 * @packageDocumentation
 */

/** 矩形。 */
export interface Rect { left: number; top: number; width: number; height: number }

/**
 * ドラッグの始点・終点から正規化した矩形(負の幅を吸収)。
 *
 *
 * @param a / b 2 点
 * @returns 正規化した矩形(**逆方向のドラッグに対応**)
 */
export function rectFromPoints(x1: number, y1: number, x2: number, y2: number): Rect {
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

/**
 * 表示上の矩形を、画像の自然解像度の矩形へ変換する。
 *
 *
 * @param rect 表示上の矩形
 * @param scale 表示倍率
 * @returns 元画像の座標系の矩形(**縮小表示で切り抜くとき、そのままの座標では合わない**)
 */
export function displayToNaturalRect(rect: Rect, displayW: number, displayH: number, naturalW: number, naturalH: number): Rect {
  const sx = naturalW / displayW;
  const sy = naturalH / displayH;
  const left = Math.max(0, Math.round(rect.left * sx));
  const top = Math.max(0, Math.round(rect.top * sy));
  const width = Math.max(1, Math.min(Math.round(rect.width * sx), naturalW - left));
  const height = Math.max(1, Math.min(Math.round(rect.height * sy), naturalH - top));
  return { left, top, width, height };
}
