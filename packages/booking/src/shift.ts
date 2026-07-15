/**
 * スタッフ/キャストのシフトと空き枠(純ロジック)。
 * 全体のスロットに各スタッフの勤務時間帯(シフト)を重ね、そのスタッフの予約可能枠を求める。
 * 複数スタッフのシフトから、スロットごとの受入可能人数(動的キャパシティ)も計算する。
 * @packageDocumentation
 */
import { type Slot } from "./slots.js";
import { timeToMinutes } from "./hours.js";
import { type BookingInterval, intervalsOverlap } from "./availability.js";

/** 勤務時間帯(シフト)。 */
export interface Shift {
  /** 開始 "HH:MM"。 */
  start: string;
  /** 終了 "HH:MM"。 */
  end: string;
}

/** スロットがいずれかのシフトに完全に収まるか。 */
export function isWithinShift(slot: Slot, shifts: Shift[]): boolean {
  const s = timeToMinutes(slot.start);
  const e = timeToMinutes(slot.end);
  return shifts.some((shift) => s >= timeToMinutes(shift.start) && e <= timeToMinutes(shift.end));
}

/** シフト内に収まるスロットだけを返す(そのスタッフが対応できる枠)。 */
export function staffSlots(slots: Slot[], shifts: Shift[]): Slot[] {
  return slots.filter((slot) => isWithinShift(slot, shifts));
}

/**
 * 1 スタッフの予約可能枠を返す(シフト内 かつ そのスタッフの予約と重ならない)。
 * 指名予約(キャスト 1 人)を想定し capacity は 1。
 */
export function staffAvailableSlots(slots: Slot[], shifts: Shift[], staffBookings: BookingInterval[]): Slot[] {
  return staffSlots(slots, shifts).filter(
    (slot) => !staffBookings.some((b) => intervalsOverlap(slot.start, slot.end, b.start, b.end)),
  );
}

/** 勤務時間の合計(分)。 */
export function shiftMinutes(shifts: Shift[]): number {
  return shifts.reduce((sum, s) => sum + (timeToMinutes(s.end) - timeToMinutes(s.start)), 0);
}

/**
 * スロットごとに勤務中のスタッフ数を数える(動的キャパシティ)。
 * @param staffShifts スタッフ ID → シフト
 */
export function slotStaffing(slots: Slot[], staffShifts: Record<string, Shift[]>): { slot: Slot; staffCount: number }[] {
  const entries = Object.values(staffShifts);
  return slots.map((slot) => ({
    slot,
    staffCount: entries.filter((shifts) => isWithinShift(slot, shifts)).length,
  }));
}

/**
 * スタッフ配置を考慮した空き枠を返す(勤務中スタッフ数 > その枠に重なる予約数)。
 * 指名なし予約で、店全体のキャパシティが時間帯ごとに変わる場合に使う。
 */
export function availableWithStaffing(
  slots: Slot[],
  staffShifts: Record<string, Shift[]>,
  bookings: BookingInterval[],
): { slot: Slot; remaining: number }[] {
  return slotStaffing(slots, staffShifts)
    .map(({ slot, staffCount }) => {
      const booked = bookings.filter((b) => intervalsOverlap(slot.start, slot.end, b.start, b.end)).length;
      return { slot, remaining: Math.max(0, staffCount - booked) };
    })
    .filter((x) => x.remaining > 0);
}
