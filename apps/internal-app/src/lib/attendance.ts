/**
 * 勤怠集計ロジック(純)。打刻(出勤/退勤)から実働・残業・月次を計算する。
 * 表示は `@platform/datetime` の formatDuration、集計は `@platform/utils` の sum を利用。
 * @packageDocumentation
 */
import { formatDuration } from "@platform/datetime";
import { sum } from "@platform/utils";

/** 勤怠 1 日分。 */
export interface AttendanceRecord {
  /** 日付(YYYY-MM-DD)。 */
  date: string;
  /** 出勤(HH:mm)。 */
  clockIn: string;
  /** 退勤(HH:mm)。 */
  clockOut: string;
  /** 休憩(分)。既定 60。 */
  breakMinutes?: number;
}

/** 所定労働時間(分)。既定 8 時間。 */
export const STANDARD_WORK_MINUTES = 8 * 60;

/** "HH:mm" を 0 時からの分に変換(不正は NaN)。 */
export function hhmmToMinutes(hhmm: string): number {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 47 || min > 59) return NaN;
  return h * 60 + min;
}

/** 実働時間(分)。退勤が出勤より前なら翌日跨ぎとして +24h。負にはしない。 */
export function workedMinutes(record: AttendanceRecord): number {
  const start = hhmmToMinutes(record.clockIn);
  let end = hhmmToMinutes(record.clockOut);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  if (end < start) end += 24 * 60; // 夜勤(日跨ぎ)
  const worked = end - start - (record.breakMinutes ?? 60);
  return Math.max(0, worked);
}

/** 残業時間(分)。所定を超えた分。 */
export function overtimeMinutes(record: AttendanceRecord, standard = STANDARD_WORK_MINUTES): number {
  return Math.max(0, workedMinutes(record) - standard);
}

/** 分を「8時間30分」表記に整形する。 */
export function formatWorked(minutes: number): string {
  return formatDuration(minutes * 60);
}

/** 勤怠サマリ。 */
export interface AttendanceSummary {
  days: number;
  totalWorkedMinutes: number;
  totalOvertimeMinutes: number;
  averageWorkedMinutes: number;
}

/** 勤怠一覧のサマリを算出する。 */
export function summarizeAttendance(records: readonly AttendanceRecord[], standard = STANDARD_WORK_MINUTES): AttendanceSummary {
  const worked = records.map((r) => workedMinutes(r));
  const overtime = records.map((r) => overtimeMinutes(r, standard));
  const total = sum(worked);
  return {
    days: records.length,
    totalWorkedMinutes: total,
    totalOvertimeMinutes: sum(overtime),
    averageWorkedMinutes: records.length ? Math.round(total / records.length) : 0,
  };
}
