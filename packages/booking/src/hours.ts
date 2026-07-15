/**
 * 営業時間(純ロジック)。
 * 曜日ごとの営業時間帯(昼休みなどで分割可)、臨時休業日・特別営業時間を扱う。
 * 時刻は "HH:MM"(24 時間表記)。
 * @packageDocumentation
 */

/** 曜日(0=日曜 … 6=土曜)。 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 営業時間帯。 */
export interface TimeRange {
  /** 開始 "HH:MM"。 */
  open: string;
  /** 終了 "HH:MM"。 */
  close: string;
}

/** 曜日ごとの営業時間(1 日に複数帯=昼休みで分割など)。 */
export type WeeklyHours = Partial<Record<Weekday, TimeRange[]>>;

/** "HH:MM" を 0 時からの分に変換する。 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** 分を "HH:MM" に変換する。 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 日付(ISO 文字列 or Date)から曜日を得る。 */
export function weekdayOf(date: string | Date): Weekday {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getDay() as Weekday;
}

/** 特別営業時間・臨時休業の設定。 */
export interface HoursOverrides {
  /** 臨時休業日(ISO 日付 "YYYY-MM-DD")。 */
  closedDates?: string[];
  /** 特別営業時間(ISO 日付 → 時間帯。空配列で休業)。 */
  specialDates?: Record<string, TimeRange[]>;
}

/** ISO 日時から "YYYY-MM-DD" を取り出す。 */
function dateKey(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 指定日の営業時間帯を解決する(特別営業 > 臨時休業 > 通常曜日)。 */
export function resolveDayHours(date: string | Date, weekly: WeeklyHours, overrides: HoursOverrides = {}): TimeRange[] {
  const key = dateKey(date);
  if (overrides.specialDates && key in overrides.specialDates) return overrides.specialDates[key]!;
  if (overrides.closedDates?.includes(key)) return [];
  return weekly[weekdayOf(date)] ?? [];
}

/** その日が営業日か(営業時間帯が 1 つ以上あるか)。 */
export function isBusinessDay(date: string | Date, weekly: WeeklyHours, overrides?: HoursOverrides): boolean {
  return resolveDayHours(date, weekly, overrides).length > 0;
}

/** 指定日時が営業時間内か。 */
export function isOpenAt(date: string | Date, time: string, weekly: WeeklyHours, overrides?: HoursOverrides): boolean {
  const minutes = timeToMinutes(time);
  return resolveDayHours(date, weekly, overrides).some((r) => minutes >= timeToMinutes(r.open) && minutes < timeToMinutes(r.close));
}
