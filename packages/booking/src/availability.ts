/**
 * 空き枠の計算(純ロジック)。
 * 生成したスロットと既存予約から、予約可能なスロットを求める。同時受入数(キャパシティ)を考慮。
 * キャストや席が複数あれば capacity を上げる。
 * @packageDocumentation
 */
import { type Slot } from "./slots.js";
import { timeToMinutes } from "./hours.js";

/** 既存予約(時間帯)。 */
export interface BookingInterval {
  /** 開始 "HH:MM"。 */
  start: string;
  /** 終了 "HH:MM"。 */
  end: string;
}

/**
 * 2 つの時間帯が重なるかを判定する。
 *
 * **半開区間 `[s, e)`** で扱う(10:00–11:00 と 11:00–12:00 は重ならない)。
 * これを閉区間にすると、連続した予約が「重なっている」ことになる。
 *
 * @param a 時間帯
 * @param b 時間帯
 * @returns 重なれば true
 */
export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

/**
 * スロットに重なる予約の数を数える。
 *
 * **有効な予約だけを数える**(キャンセル済みは枠を占有しない)。
 *
 * @param slot スロット
 * @param bookings 予約の配列
 * @returns 重なる予約の数
 */
export function countOverlapping(slot: Slot, bookings: BookingInterval[]): number {
  return bookings.filter((b) => intervalsOverlap(slot.start, slot.end, b.start, b.end)).length;
}

/**
 * スロットが予約可能かを判定する。
 *
 * @param slot スロット
 * @param bookings 予約の配列
 * @param capacity 同時に受け入れられる数
 * @returns 空きがあれば true
 */
export function isSlotAvailable(slot: Slot, bookings: BookingInterval[], capacity = 1): boolean {
  return countOverlapping(slot, bookings) < capacity;
}

/**
 * 予約可能なスロットだけを返す。
 *
 * **画面に出す前に通す**(埋まっている枠を「予約できます」と見せない)。
 *
 * @param slots スロットの配列
 * @param bookings 予約の配列
 * @param capacity 同時受入数
 * @returns 空きのあるスロット
 */
export function availableSlots(slots: Slot[], bookings: BookingInterval[], capacity = 1): Slot[] {
  return slots.filter((s) => isSlotAvailable(s, bookings, capacity));
}

/**
 * 各スロットの残り枠を返す。
 *
 * **「あと 2 席」と出す**のに使う(残りが少ないと分かると予約が促される)。
 *
 * @param slots スロットの配列
 * @param bookings 予約の配列
 * @param capacity 同時受入数
 * @returns スロットと残り数
 */
export function remainingCapacity(slots: Slot[], bookings: BookingInterval[], capacity = 1): { slot: Slot; remaining: number }[] {
  return slots.map((slot) => ({ slot, remaining: Math.max(0, capacity - countOverlapping(slot, bookings)) }));
}

/**
 * 新規予約が衝突するかを判定する。
 *
 * **保存の直前に必ず確認する**(画面で選んでから保存までの間に、
 * 他の人が予約を入れることがある)。
 *
 * @param slot 予約したいスロット
 * @param bookings 既存の予約
 * @param capacity 同時受入数
 * @returns 衝突すれば true
 */
export function hasConflict(candidate: BookingInterval, bookings: BookingInterval[], capacity = 1): boolean {
  const overlapping = bookings.filter((b) => intervalsOverlap(candidate.start, candidate.end, b.start, b.end)).length;
  return overlapping >= capacity;
}
