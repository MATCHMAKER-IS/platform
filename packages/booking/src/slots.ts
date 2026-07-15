/**
 * 予約スロット生成(純ロジック)。
 * 営業時間帯から一定間隔のスロット(予約枠)を作る。所要時間・刻み幅を指定できる。
 * @packageDocumentation
 */
import { type TimeRange, timeToMinutes, minutesToTime } from "./hours.js";

/** 予約スロット。 */
export interface Slot {
  /** 開始 "HH:MM"。 */
  start: string;
  /** 終了 "HH:MM"。 */
  end: string;
}

/** スロット生成のオプション。 */
export interface SlotOptions {
  /** 1 スロットの所要時間(分)。 */
  slotMinutes: number;
  /** 開始時刻の刻み幅(分・既定は slotMinutes と同じ)。 */
  stepMinutes?: number;
}

/** 1 つの営業時間帯からスロットを生成する。 */
export function slotsForRange(range: TimeRange, options: SlotOptions): Slot[] {
  const open = timeToMinutes(range.open);
  const close = timeToMinutes(range.close);
  const step = options.stepMinutes ?? options.slotMinutes;
  const slots: Slot[] = [];
  for (let start = open; start + options.slotMinutes <= close; start += step) {
    slots.push({ start: minutesToTime(start), end: minutesToTime(start + options.slotMinutes) });
  }
  return slots;
}

/** 複数の営業時間帯からスロットを生成する(昼休みで分割された営業などに)。 */
export function generateSlots(ranges: TimeRange[], options: SlotOptions): Slot[] {
  return ranges.flatMap((r) => slotsForRange(r, options));
}

/** スロットの所要時間(分)。 */
export function slotDuration(slot: Slot): number {
  return timeToMinutes(slot.end) - timeToMinutes(slot.start);
}
