/**
 * 特性値(DataView)の解析ヘルパー(純関数)と、よく使う GATT UUID。
 * @packageDocumentation
 */

/** DataView を UTF-8 文字列として読む。 */
export function parseText(view: DataView): string {
  return new TextDecoder().decode(view.buffer);
}

/** 指定位置の符号なし 8bit 整数を読む。 */
export function parseUint8(view: DataView, offset = 0): number {
  return view.getUint8(offset);
}

/** 指定位置の符号なし 16bit 整数を読む(既定リトルエンディアン)。 */
export function parseUint16(view: DataView, offset = 0, littleEndian = true): number {
  return view.getUint16(offset, littleEndian);
}

/** DataView をバイト配列にする。 */
export function toBytes(view: DataView): number[] {
  return Array.from({ length: view.byteLength }, (_v, i) => view.getUint8(i));
}

/** 文字列を書き込み用の ArrayBuffer(UTF-8)にする。 */
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
