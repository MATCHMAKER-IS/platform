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

/** 2 つの時間帯が重なるか([s,e) 半開区間)。 */
export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

/** あるスロットに重なる予約の数を数える。 */
export function countOverlapping(slot: Slot, bookings: BookingInterval[]): number {
  return bookings.filter((b) => intervalsOverlap(slot.start, slot.end, b.start, b.end)).length;
}

/** そのスロットが予約可能か(重なり数 < キャパシティ)。 */
export function isSlotAvailable(slot: Slot, bookings: BookingInterval[], capacity = 1): boolean {
  return countOverlapping(slot, bookings) < capacity;
}

/** 予約可能なスロットだけを返す。 */
export function availableSlots(slots: Slot[], bookings: BookingInterval[], capacity = 1): Slot[] {
  return slots.filter((s) => isSlotAvailable(s, bookings, capacity));
}

/** 各スロットの残り受入可能数を返す。 */
export function remainingCapacity(slots: Slot[], bookings: BookingInterval[], capacity = 1): { slot: Slot; remaining: number }[] {
  return slots.map((slot) => ({ slot, remaining: Math.max(0, capacity - countOverlapping(slot, bookings)) }));
}

/** 新規予約が既存予約と衝突するか(capacity を超えるか)。 */
export function hasConflict(candidate: BookingInterval, bookings: BookingInterval[], capacity = 1): boolean {
  const overlapping = bookings.filter((b) => intervalsOverlap(candidate.start, candidate.end, b.start, b.end)).length;
  return overlapping >= capacity;
}
