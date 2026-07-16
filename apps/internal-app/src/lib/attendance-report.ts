/**
 * 勤怠の月次 Excel シート生成(純)。`@platform/xlsx` の writeWorkbook に渡せる形にする。
 * @packageDocumentation
 */
import { workedMinutes, overtimeMinutes, formatWorked, type AttendanceRecord } from "./attendance";
import { monthlyAttendance, type MonthlyAttendance } from "./attendance-monthly";

/** xlsx シート(SheetInput 互換: rows 値は string|number)。 */
export interface ReportSheet { name: string; rows: Record<string, string | number>[]; freezeHeader: boolean }

/** 月次サマリ + 日次明細の 2 シートを作る。 */
export function attendanceReportSheets(records: readonly AttendanceRecord[], yearMonth: string): ReportSheet[] {
  const monthRecords = records.filter((r) => r.date.startsWith(yearMonth));
  const m: MonthlyAttendance = monthlyAttendance(records, yearMonth);

  const summary: Record<string, string | number>[] = [
    { 項目: "対象月", 値: yearMonth },
    { 項目: "出勤日数", 値: m.workedDays },
    { 項目: "営業日数", 値: m.expectedWorkdays },
    { 項目: "出勤率", 値: `${Math.round(m.attendanceRate * 100)}%` },
    { 項目: "総実働", 値: formatWorked(m.totalWorkedMinutes) },
    { 項目: "残業合計", 値: formatWorked(m.totalOvertimeMinutes) },
    { 項目: "平均実働/日", 値: formatWorked(m.averageWorkedMinutes) },
    { 項目: "有給取得", 値: m.paidLeaveDays },
  ];

  const detail: Record<string, string | number>[] = monthRecords.map((r) => ({
    日付: r.date,
    出勤: r.clockIn,
    退勤: r.clockOut,
    休憩分: r.breakMinutes ?? 60,
    実働分: workedMinutes(r),
    残業分: overtimeMinutes(r),
  }));

  return [
    { name: "サマリ", rows: summary, freezeHeader: true },
    { name: "明細", rows: detail, freezeHeader: true },
  ];
}
