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

/**
 * `HH:MM` を 0 時からの分に変換する。
 *
 * **深夜営業は 24 時を超える**(`26:00` = 翌 2:00)ので、Date ではなく分で扱う。
 *
 * **形式が違えば例外を投げる。** 2026-08 まで `NaN` や `0` を返しており、
 * **二重予約が通る**状態だった——`intervalsOverlap` は `NaN` との比較が
 * すべて `false` になるので、「重なっていない」と判定される。
 * 空文字は `0`(= 00:00)扱いになり、**深夜の予約が取れて**しまう。
 *
 * 渡すのは**設定値**(就業時間・営業時間)なので、
 * **不正なら早く気づく方がよい**。
 *
 * @param time `HH:MM` 形式(`26:00` のような 24 時超えも可)
 * @returns 0 時からの分
 * @throws `Error` — `HH:MM` の形式でない場合
 */
export function timeToMinutes(time: string): number {
  // **分は 0〜59 に限る。** `09:70` を 610(= 10:10)として通すと、
  // 設定の打ち間違いが**別の時刻として動いてしまう**
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(time);
  if (m === null) {
    throw new Error(`時刻の形式が不正です: ${JSON.stringify(time)}(HH:MM で指定してください)`);
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * 分を `HH:MM` に変換する。
 *
 * @param minutes 0 時からの分
 * @returns `HH:MM` 形式(**0 埋め**)
 */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * 日付から曜日を返す。
 *
 * @param date ISO 文字列または Date
 * @returns 0(日)〜6(土)
 */
export function weekdayOf(date: string | Date): Weekday {
  // **JST の曜日で見る。** `getDay()` はサーバのローカル時刻で動くので、
  // UTC のサーバでは **JST の 00:00〜08:59 が前日の曜日**になる
  // ——JST 月曜 8:00 が日曜と判定され、**日曜定休の店で月曜朝の予約が取れない**
  // (2026-08 に修正)。
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).getUTCDay() as Weekday;
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
  // **JST の日付で切る**(`weekdayOf` と同じ理由)。
  // UTC で切ると、JST 早朝の予約が**前日の臨時休業設定**に当たる
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 指定日の営業時間を解決する。
 *
 * **優先順位: 特別営業 > 臨時休業 > 通常の曜日**。
 * 「祝日だが特別に営業する」を表現できるようにするため、この順序にしてある。
 *
 * @param date 対象の日
 * @param weekly 曜日ごとの営業時間
 * @param overrides 特別営業時間・臨時休業（**日付単位で上書きする**。祝日や年末年始）
 * @returns その日の営業時間帯。**休業日なら空配列**
 */
export function resolveDayHours(date: string | Date, weekly: WeeklyHours, overrides: HoursOverrides = {}): TimeRange[] {
  const key = dateKey(date);
  if (overrides.specialDates && key in overrides.specialDates) return overrides.specialDates[key]!;
  if (overrides.closedDates?.includes(key)) return [];
  return weekly[weekdayOf(date)] ?? [];
}

/**
 * その日が営業日かを判定する。
 *
 * @param date 対象の日
 * @param weekly 曜日ごとの営業時間
 * @param overrides 特別営業時間・臨時休業（**日付単位で上書きする**。祝日や年末年始）
 * @returns 営業日なら true
 */
export function isBusinessDay(date: string | Date, weekly: WeeklyHours, overrides?: HoursOverrides): boolean {
  return resolveDayHours(date, weekly, overrides).length > 0;
}

/**
 * 指定日時が営業時間内かを判定する。
 *
 * @param date 対象の日
 * @param time 判定する時刻（"HH:mm"）
 * @param weekly 曜日ごとの営業時間
 * @param overrides 特別営業時間・臨時休業
 * @returns 営業時間内なら true
 */
export function isOpenAt(date: string | Date, time: string, weekly: WeeklyHours, overrides?: HoursOverrides): boolean {
  const minutes = timeToMinutes(time);
  return resolveDayHours(date, weekly, overrides).some((r) => minutes >= timeToMinutes(r.open) && minutes < timeToMinutes(r.close));
}
