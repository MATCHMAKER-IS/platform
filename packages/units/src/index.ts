/**
 * 単位変換(純)。長さ・重さ・面積・体積・温度、および日本の尺貫法(坪/畳)。
 * 各系統は基準単位への係数で表現し、任意単位間を換算する。
 * @packageDocumentation
 */

/** 基準単位への係数で単位換算する汎用ファクトリ。 */
function makeConverter<U extends string>(factors: Record<U, number>) {
  return (value: number, from: U, to: U): number => {
    const f = factors[from], t = factors[to];
    return (value * f) / t;
  };
}

/** 長さ(基準: メートル)。 */
export type LengthUnit = "mm" | "cm" | "m" | "km" | "in" | "ft" | "yd" | "mi";
const LENGTH: Record<LengthUnit, number> = { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344 };
/** 長さを換算する。 */
export const convertLength = makeConverter(LENGTH);

/** 重さ(基準: グラム)。 */
export type WeightUnit = "mg" | "g" | "kg" | "t" | "oz" | "lb";
const WEIGHT: Record<WeightUnit, number> = { mg: 0.001, g: 1, kg: 1000, t: 1_000_000, oz: 28.349523125, lb: 453.59237 };
/** 重さを換算する。 */
export const convertWeight = makeConverter(WEIGHT);

/** 面積(基準: 平方メートル)。日本の坪・畳(中京間 1.6562㎡は地域差があるため一般値)。 */
export type AreaUnit = "cm2" | "m2" | "km2" | "ha" | "acre" | "tsubo" | "jo";
const AREA: Record<AreaUnit, number> = { cm2: 0.0001, m2: 1, km2: 1_000_000, ha: 10_000, acre: 4046.8564224, tsubo: 3.305785, jo: 1.62 };
/** 面積を換算する。 */
export const convertArea = makeConverter(AREA);

/** 体積(基準: リットル)。 */
export type VolumeUnit = "ml" | "l" | "m3" | "gal_us" | "gal_uk" | "cup_jp" | "sho";
const VOLUME: Record<VolumeUnit, number> = { ml: 0.001, l: 1, m3: 1000, gal_us: 3.785411784, gal_uk: 4.54609, cup_jp: 0.2, sho: 1.8039 };
/** 体積を換算する。 */
export const convertVolume = makeConverter(VOLUME);

/** 温度(非線形なので個別実装)。 */
export type TempUnit = "C" | "F" | "K";
/**
 * 温度を換算する。
 *
 * **温度は他の単位と違い、0 が原点ではない**(摂氏 0 度 = 華氏 32 度)。
 * 単純な倍率では換算できないので、専用の関数にしてある。
 *
 * @param value 値
 * @param from 変換元(`C` / `F` / `K`)
 * @param to 変換先
 * @returns 換算した値
 */
export function convertTemperature(value: number, from: TempUnit, to: TempUnit): number {
  // まず摂氏へ
  const celsius = from === "C" ? value : from === "F" ? (value - 32) * (5 / 9) : value - 273.15;
  if (to === "C") return celsius;
  if (to === "F") return celsius * (9 / 5) + 32;
  return celsius + 273.15;
}

/**
 * 換算して指定桁で丸める(表示用)。
 *
 * **計算の途中では丸めないこと**(誤差が積み重なる)。表示の直前だけに使う。
 *
 * @param value 値
 * @param from 変換元の単位
 * @param to 変換先の単位
 * @param decimals 小数桁
 * @returns 換算して丸めた値
 */
export function round(value: number, digits = 2): number {
  const f = Math.pow(10, digits);
  return Math.round((value + (value >= 0 ? 1 : -1) * 1e-12) * f) / f;
}
