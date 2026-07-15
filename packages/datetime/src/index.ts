/**
 * `@platform/datetime` — 日本時間(JST)前提の日時ユーティリティ。
 *
 * 日本の業務アプリで事故りやすい「タイムゾーン境界・整形」を共通化する。
 * 内部実装は date-fns / date-fns-tz。UTC で保存し、表示・境界計算は JST で行う。
 *
 * @packageDocumentation
 */

import { startOfDay, endOfDay } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

/** 日本標準時のタイムゾーン識別子。 */
export const JST = "Asia/Tokyo";

/**
 * UTC の Date を JST として整形する。
 * @param date   整形対象(UTC 基準の Date)
 * @param format date-fns の書式(既定: `"yyyy-MM-dd HH:mm"`)
 * @returns JST に変換した文字列
 * @example
 * ```ts
 * formatJst(new Date("2026-01-01T00:00:00Z")); // "2026-01-01 09:00"
 * ```
 */
export function formatJst(date: Date, format = "yyyy-MM-dd HH:mm"): string {
  return formatInTimeZone(date, JST, format);
}

/**
 * JST におけるその日の始まり(00:00:00)を UTC の Date で返す。
 * 「今日の集計」などの範囲指定に使う。
 * @param date 基準日時
 * @returns JST 00:00 に対応する UTC 時刻
 */
export function startOfDayJst(date: Date): Date {
  const zoned = toZonedTime(date, JST);
  return fromZonedTime(startOfDay(zoned), JST);
}

/**
 * JST におけるその日の終わり(23:59:59.999)を UTC の Date で返す。
 * @param date 基準日時
 * @returns JST 23:59:59.999 に対応する UTC 時刻
 */
export function endOfDayJst(date: Date): Date {
  const zoned = toZonedTime(date, JST);
  return fromZonedTime(endOfDay(zoned), JST);
}

export * from "./calendar.js";
