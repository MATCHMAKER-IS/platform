/**
 * 勤怠の月次集計(営業日・出勤率・有給)。`@platform/datetime` の営業日/祝日判定を活用。
 * @packageDocumentation
 */
import { utcDate, daysInMonth, isBusinessDay } from "@platform/datetime";
import { summarizeAttendance, type AttendanceRecord } from "./attendance";

/**
 * 指定月(year, month=1〜12)の営業日数(土日・祝日を除く)。
 *
 * **会社休日を渡すこと。** 年末年始(12/29〜1/3)や夏季休暇は**祝日ではない**ので、
 * 渡さないと営業日として数えられる——**12 月は 3 日・1 月は 2 日多く出る**。
 *
 * 所定労働日数が過大になると**出勤率(実績 ÷ 所定)が低く出る**ため、
 * **有給の付与条件(出勤率 8 割)の判定を誤らせる**。
 * 12 月と 1 月だけ勤怠の見え方が変わるので、原因も分かりにくい(2026-08 に対応)。
 *
 * @param year 年
 * @param month 月(1〜12)
 * @param extraHolidays 会社休日(`"YYYY-MM-DD"` の集合。就業規則のカレンダー)
 * @returns 営業日数
 */
export function expectedWorkdays(year: number, month: number, extraHolidays?: ReadonlySet<string>): number {
  let count = 0;
  const dim = daysInMonth(year, month);
  for (let d = 1; d <= dim; d++) {
    if (isBusinessDay(utcDate(year, month, d), extraHolidays)) count++;
  }
  return count;
}

/** 有給などの休暇 1 件。 */
export interface LeaveRecord {
  date: string;
  type: "paid" | "sick" | "special";
}

/** 月次勤怠サマリ。 */
export interface MonthlyAttendance {
  yearMonth: string;
  workedDays: number;
  expectedWorkdays: number;
  attendanceRate: number;
  totalWorkedMinutes: number;
  totalOvertimeMinutes: number;
  averageWorkedMinutes: number;
  paidLeaveDays: number;
}

function inMonth(dateIso: string, ym: string): boolean {
  return dateIso.startsWith(ym);
}

/** 指定月(YYYY-MM)の勤怠を集計する。 */
export function monthlyAttendance(
  records: readonly AttendanceRecord[],
  yearMonth: string,
  leaves: readonly LeaveRecord[] = [],
  /** 会社休日(`"YYYY-MM-DD"` の集合)。**渡さないと年末年始が営業日に数えられる**。 */
  extraHolidays?: ReadonlySet<string>,
): MonthlyAttendance {
  const [y, m] = yearMonth.split("-").map(Number);
  const monthRecords = records.filter((r) => inMonth(r.date, yearMonth));
  const summary = summarizeAttendance(monthRecords);
  const expected = y && m ? expectedWorkdays(y, m, extraHolidays) : 0;
  const paidLeaveDays = leaves.filter((l) => inMonth(l.date, yearMonth) && l.type === "paid").length;
  return {
    yearMonth,
    workedDays: summary.days,
    expectedWorkdays: expected,
    attendanceRate: expected > 0 ? summary.days / expected : 0,
    totalWorkedMinutes: summary.totalWorkedMinutes,
    totalOvertimeMinutes: summary.totalOvertimeMinutes,
    averageWorkedMinutes: summary.averageWorkedMinutes,
    paidLeaveDays,
  };
}

/** 対象月(YYYY-MM)一覧を新しい順で返す。 */
export function attendanceMonths(records: readonly AttendanceRecord[]): string[] {
  return [...new Set(records.map((r) => r.date.slice(0, 7)))].sort().reverse();
}

/** 未消化に警告が必要か(残業が閾値超・出勤率が閾値未満)。 */
export function attendanceAlerts(m: MonthlyAttendance, options: { overtimeLimitMinutes?: number } = {}): string[] {
  const alerts: string[] = [];
  const limit = options.overtimeLimitMinutes ?? 45 * 60; // 月45時間
  if (m.totalOvertimeMinutes > limit) alerts.push("残業が月間上限を超えています");
  if (m.expectedWorkdays > 0 && m.attendanceRate < 0.8) alerts.push("出勤率が低下しています");
  return alerts;
}
