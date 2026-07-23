/**
 * 勤怠の記録と集計(純ロジック)。
 *
 * もとは社内アプリの中にあったが、**次のアプリを作れば必ず再実装される**ため基盤へ移した。
 * 給与計算(`@platform/payroll`)は「分数から金額を出す」ところを担当し、
 * こちらは**その入力となる分数を、打刻から作る**ところを担当する。
 *
 * 保存先(`AttendanceStore`)はアプリが用意する。開発ではメモリ、本番は DB。
 * @packageDocumentation
 */
import { splitDailyWork, parseTimeToMinutes } from "@platform/payroll";

/** 1 日の打刻。 */
export interface AttendanceEntry {
  /** 日付(YYYY-MM-DD)。 */
  date: string;
  /** 出勤時刻(HH:mm)。 */
  clockIn: string;
  /** 退勤時刻(HH:mm)。**出勤より前なら翌日として扱う**(夜勤)。 */
  clockOut: string;
  /** 休憩(分)。 */
  breakMinutes?: number;
  /** 法定休日の勤務か。 */
  isHoliday?: boolean;
  /** 勤務区分(通常 / 直行直帰 / 振替出勤など)。集計は変えず、記録として残す。 */
  workType?: string;
  /** 備考(遅刻の理由など)。 */
  note?: string;
}

/** 集計済みの 1 日。 */
export interface AttendanceDay extends AttendanceEntry {
  totalMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  holidayMinutes: number;
  /** 遅刻した分(所定の始業より遅い場合)。 */
  lateMinutes: number;
  /** 早退した分(所定の終業より早い場合)。 */
  earlyLeaveMinutes: number;
}

/** 月次サマリー。 */
export interface AttendanceSummary {
  month: string;
  days: AttendanceDay[];
  totalMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  holidayMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  /** 出勤した日数。 */
  workedDays: number;
}

/** 所定労働時間の設定。会社ごとに違うため引数で受ける。 */
export interface WorkingHours {
  /** 始業(HH:mm。既定 "09:00")。 */
  start?: string;
  /** 終業(HH:mm。既定 "18:00")。 */
  end?: string;
  /** 遅刻とみなさない猶予(分。既定 0)。 */
  graceMinutes?: number;
}

/**
 * 打刻 1 件を集計する。
 *
 * 退勤が出勤より前なら**翌日にまたいだ**とみなす(夜勤)。
 * 遅刻・早退は所定労働時間との差で判定するが、**休日勤務では判定しない**
 * (所定の始業が存在しないため)。
 *
 * @param entry 打刻
 * @param hours 所定労働時間(省略時は 9:00-18:00)
 * @returns 集計済みの 1 日
 *
 * @example
 * ```ts
 * toDay({ date: "2026-07-22", clockIn: "09:15", clockOut: "20:00", breakMinutes: 60 });
 * // → totalMinutes 585 / overtimeMinutes 105 / lateMinutes 15
 * ```
 */
export function toDay(entry: AttendanceEntry, hours: WorkingHours = {}): AttendanceDay {
  const startMin = parseTimeToMinutes(entry.clockIn);
  let endMin = parseTimeToMinutes(entry.clockOut);
  if (endMin <= startMin) endMin += 1440; // 日をまたぐ勤務

  const split = splitDailyWork({
    startMin,
    endMin,
    breakMinutes: entry.breakMinutes ?? 0,
    isHoliday: entry.isHoliday ?? false,
  });

  const scheduledStart = parseTimeToMinutes(hours.start ?? "09:00");
  const scheduledEnd = parseTimeToMinutes(hours.end ?? "18:00");
  const grace = hours.graceMinutes ?? 0;
  const isHoliday = entry.isHoliday ?? false;

  return {
    ...entry,
    totalMinutes: split.totalMinutes,
    overtimeMinutes: split.overtimeMinutes,
    nightMinutes: split.nightMinutes,
    holidayMinutes: split.holidayMinutes,
    // 休日は所定が無いので遅刻・早退の概念を持ち込まない
    lateMinutes: isHoliday ? 0 : Math.max(0, startMin - scheduledStart - grace),
    earlyLeaveMinutes: isHoliday ? 0 : Math.max(0, scheduledEnd - Math.min(endMin, scheduledEnd + 1440)),
  };
}

/**
 * 月次で集計する。
 *
 * @param month   対象月(YYYY-MM)
 * @param entries その月の打刻
 * @param hours   所定労働時間
 * @returns 月次サマリー(日付昇順)
 */
export function summarize(month: string, entries: AttendanceEntry[], hours: WorkingHours = {}): AttendanceSummary {
  const days = entries
    .map((e) => toDay(e, hours))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const sum = (pick: (d: AttendanceDay) => number) => days.reduce((s, d) => s + pick(d), 0);
  return {
    month,
    days,
    totalMinutes: sum((d) => d.totalMinutes),
    overtimeMinutes: sum((d) => d.overtimeMinutes),
    nightMinutes: sum((d) => d.nightMinutes),
    holidayMinutes: sum((d) => d.holidayMinutes),
    lateMinutes: sum((d) => d.lateMinutes),
    earlyLeaveMinutes: sum((d) => d.earlyLeaveMinutes),
    workedDays: days.filter((d) => d.totalMinutes > 0).length,
  };
}

/** 勤怠ストア。保存先はアプリが決める。 */
export interface AttendanceStore {
  list(userId: string): Promise<AttendanceEntry[]>;
  record(userId: string, entry: AttendanceEntry): Promise<AttendanceDay>;
  /** 月次集計(month は "YYYY-MM")。 */
  monthly(userId: string, month: string): Promise<AttendanceSummary>;
}

/**
 * メモリ実装(開発・テスト用)。
 *
 * **本番では DB 実装を使うこと。** 勤怠は賃金台帳の元になるため、
 * 消えると法定帳簿が作れなくなる。
 *
 * @param hours 所定労働時間
 * @returns メモリ上のストア
 */
export function createMemoryAttendanceStore(hours: WorkingHours = {}): AttendanceStore {
  const byUser = new Map<string, AttendanceEntry[]>();
  return {
    async list(userId) {
      return (byUser.get(userId) ?? []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    },
    async record(userId, entry) {
      const list = byUser.get(userId) ?? [];
      const idx = list.findIndex((e) => e.date === entry.date);
      // 同じ日の打刻は上書きする(打ち直しを許す)
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      byUser.set(userId, list);
      return toDay(entry, hours);
    },
    async monthly(userId, month) {
      const list = (byUser.get(userId) ?? []).filter((e) => e.date.startsWith(month));
      return summarize(month, list, hours);
    },
  };
}
