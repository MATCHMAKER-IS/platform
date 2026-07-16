/**
 * 画面の向きの判定(純ロジック)。
 * @packageDocumentation
 */

/** 画面の向き。 */
export type Orientation = "portrait" | "landscape";

/**
 * 幅・高さから画面の向きを返す。
 *
 * @param width 幅
 * @param height 高さ
 * @returns `portrait` / `landscape`(**正方形は portrait**)
 */
export function orientationFromDimensions(width: number, height: number): Orientation {
  return width > height ? "landscape" : "portrait";
}

/**
 * `ScreenOrientation.type` を単純化する。
 *
 * **`portrait-primary` / `portrait-secondary` を portrait にまとめる**
 * (上下逆さまかは、ほとんどの用途で不要)。
 *
 * @param type `ScreenOrientation.type` の値
 * @returns `portrait` / `landscape`
 */
export function simplifyOrientationType(type: string): Orientation {
  return type.startsWith("landscape") ? "landscape" : "portrait";
}
