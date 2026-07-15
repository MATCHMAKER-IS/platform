/**
 * 画面の向きの判定(純ロジック)。
 * @packageDocumentation
 */

/** 画面の向き。 */
export type Orientation = "portrait" | "landscape";

/** 幅・高さから向きを返す(正方形は portrait 扱い)。 */
export function orientationFromDimensions(width: number, height: number): Orientation {
  return width > height ? "landscape" : "portrait";
}

/** ScreenOrientation.type(例 "portrait-primary")を単純化する。 */
export function simplifyOrientationType(type: string): Orientation {
  return type.startsWith("landscape") ? "landscape" : "portrait";
}
