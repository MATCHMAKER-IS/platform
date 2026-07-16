/**
 * スタッフ/キャストのシフトと空き枠(純ロジック)。
 * 全体のスロットに各スタッフの勤務時間帯(シフト)を重ね、そのスタッフの予約可能枠を求める。
 * 複数スタッフのシフトから、スロットごとの受入可能人数(動的キャパシティ)も計算する。
 * @packageDocumentation
 */
import { type Slot } from "./slots";
import { timeToMinutes } from "./hours";
import { type BookingInterval, intervalsOverlap } from "./availability";

/** 勤務時間帯(シフト)。 */
export interface Shift {
  /** 開始 "HH:MM"。 */
  start: string;
  /** 終了 "HH:MM"。 */
  end: string;
}

/**
 * スロットがシフトに収まるかを判定する。
 *
 * **完全に収まること**が条件(担当者の勤務が 17 時までなら、
 * 16:30 開始の 1 時間枠は取れない)。
 *
 * @param slot スロット
 * @param shifts シフトの配列
 * @returns いずれかに収まれば true
 */
export function isWithinShift(slot: Slot, shifts: Shift[]): boolean {
  const s = timeToMinutes(slot.start);
  const e = timeToMinutes(slot.end);
  return shifts.some((shift) => s >= timeToMinutes(shift.start) && e <= timeToMinutes(shift.end));
}

/**
 * そのスタッフが対応できるスロットだけを返す。
 *
 * @param slots スロットの配列
 * @param shifts シフトの配列
 * @returns 対応できるスロット
 */
export function staffSlots(slots: Slot[], shifts: Shift[]): Slot[] {
  return slots.filter((slot) => isWithinShift(slot, shifts));
}

/**
 * 1 スタッフの予約可能枠を返す(シフト内 かつ そのスタッフの予約と重ならない)。
 * 指名予約(キャスト 1 人)を想定し capacity は 1。
 *
 * @param slots スロットの配列
 * @param shifts シフトの配列
 * @param bookings 既存の予約
 * @returns そのスタッフが**対応でき、かつ空いている**スロット
 */
export function staffAvailableSlots(slots: Slot[], shifts: Shift[], staffBookings: BookingInterval[]): Slot[] {
  return staffSlots(slots, shifts).filter(
    (slot) => !staffBookings.some((b) => intervalsOverlap(slot.start, slot.end, b.start, b.end)),
  );
}

/**
 * 勤務時間の合計を返す。
 *
 * @param shifts シフトの配列
 * @returns 合計の分数
 */
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
 * @param slots スロットの配列
 * @param shifts 全スタッフのシフト
 * @param bookings 既存の予約
 * @param options.minStaff 最低必要なスタッフ数
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
