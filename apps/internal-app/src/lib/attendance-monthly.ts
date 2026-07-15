/**
 * 勤怠の月次集計(営業日・出勤率・有給)。`@platform/datetime` の営業日/祝日判定を活用。
 * @packageDocumentation
 */
import { utcDate, daysInMonth, isBusinessDay, dayNumber } from "@platform/datetime";
import { summarizeAttendance, workedMinutes, type AttendanceRecord } from "./attendance.js";

/** 指定月(year, month=1〜12)の営業日数(土日・祝日を除く)。 */
export function expectedWorkdays(year: number, month: number): number {
  let count = 0;
  const dim = daysInMonth(year, month);
  for (let d = 1; d <= dim; d++) {
    if (isBusinessDay(utcDate(year, month, d))) count++;
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
): MonthlyAttendance {
  const [y, m] = yearMonth.split("-").map(Number);
  const monthRecords = records.filter((r) => inMonth(r.date, yearMonth));
  const summary = summarizeAttendance(monthRecords);
  const expected = y && m ? expectedWorkdays(y, m) : 0;
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
