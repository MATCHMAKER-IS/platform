/**
 * 予約スロット生成(純ロジック)。
 * 営業時間帯から一定間隔のスロット(予約枠)を作る。所要時間・刻み幅を指定できる。
 * @packageDocumentation
 */
import { type TimeRange, timeToMinutes, minutesToTime } from "./hours";

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

/**
 * 営業時間帯からスロットを生成する。
 *
 * @param range 営業時間帯
 * @param options.durationMin 1 枠の長さ
 * @param options.intervalMin 枠の開始間隔(**duration と違う値にできる**。30 分枠を 15 分間隔で並べるなど)
 * @returns スロットの配列
 */
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

/**
 * 複数の営業時間帯からスロットを生成する。
 *
 * **昼休みで分割された営業**(9:00–12:00 / 13:00–18:00)に対応する。
 *
 * @param ranges 営業時間帯の配列
 * @param options 枠の長さと間隔
 * @returns スロットの配列
 */
export function generateSlots(ranges: TimeRange[], options: SlotOptions): Slot[] {
  return ranges.flatMap((r) => slotsForRange(r, options));
}

/**
 * スロットの所要時間を返す。
 *
 * @param slot スロット
 * @returns 分数
 */
export function slotDuration(slot: Slot): number {
  return timeToMinutes(slot.end) - timeToMinutes(slot.start);
}
