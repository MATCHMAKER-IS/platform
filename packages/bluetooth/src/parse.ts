/**
 * 特性値(DataView)の解析ヘルパー(純関数)と、よく使う GATT UUID。
 * @packageDocumentation
 */

/**
 * DataView を UTF-8 文字列として読む。
 *
 * @param view DataView
 * @returns 文字列
 */
export function parseText(view: DataView): string {
  return new TextDecoder().decode(view.buffer);
}

/**
 * 符号なし 8bit 整数を読む。
 *
 * @param view DataView
 * @param offset 位置(既定 0)
 * @returns 0〜255。**範囲外なら 0**(例外を投げない)
 */
export function parseUint8(view: DataView, offset = 0): number {
  return view.getUint8(offset);
}

/**
 * 符号なし 16bit 整数を読む。
 *
 * **BLE の多くはリトルエンディアン**(既定)。仕様書で確認すること。
 * 間違えると値が全く違うものになる(256 倍ずれる、など)。
 *
 * @param view DataView
 * @param offset 位置(既定 0)
 * @param littleEndian リトルエンディアンか(**既定 true**)
 * @returns 0〜65535。**範囲外なら 0**
 */
export function parseUint16(view: DataView, offset = 0, littleEndian = true): number {
  return view.getUint16(offset, littleEndian);
}

/**
 * DataView をバイト配列にする。
 *
 * @param view DataView
 * @returns バイト配列
 */
export function toBytes(view: DataView): number[] {
  return Array.from({ length: view.byteLength }, (_v, i) => view.getUint8(i));
}

/**
 * 文字列を書き込み用の ArrayBuffer にする(UTF-8)。
 *
 * @param text 文字列
 * @returns ArrayBuffer(**BLE の書き込みに渡す形**)
 */
export function encodeText(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

/** よく使う GATT サービス/特性(Web Bluetooth は短縮名も受け付ける)。 */
export const GATT = {
  batteryService: "battery_service",
  batteryLevel: "battery_level",
  deviceInformation: "device_information",
  manufacturerName: "manufacturer_name_string",
  heartRate: "heart_rate",
  heartRateMeasurement: "heart_rate_measurement",
} as const;
