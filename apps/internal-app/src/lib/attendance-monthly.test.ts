import { describe, it, expect } from "vitest";
import { expectedWorkdays, monthlyAttendance, attendanceMonths, attendanceAlerts, type LeaveRecord } from "./attendance-monthly.js";
import { isBusinessDay, utcDate, daysInMonth } from "@platform/datetime";
import type { AttendanceRecord } from "./attendance.js";

const recs: AttendanceRecord[] = [
  { date: "2024-05-01", clockIn: "09:00", clockOut: "18:00" },
  { date: "2024-05-02", clockIn: "09:00", clockOut: "20:00" },
  { date: "2024-06-03", clockIn: "09:00", clockOut: "18:00" },
];
const leaves: LeaveRecord[] = [{ date: "2024-05-10", type: "paid" }, { date: "2024-05-11", type: "sick" }];

describe("attendance monthly", () => {
  it("expectedWorkdays matches independent count", () => {
    let n = 0;
    for (let d = 1; d <= daysInMonth(2024, 5); d++) if (isBusinessDay(utcDate(2024, 5, d))) n++;
    expect(expectedWorkdays(2024, 5)).toBe(n);
  });
  it("monthly aggregation", () => {
    const m = monthlyAttendance(recs, "2024-05", leaves);
    expect(m.workedDays).toBe(2); expect(m.totalOvertimeMinutes).toBe(120); expect(m.paidLeaveDays).toBe(1);
    expect(m.attendanceRate).toBeCloseTo(2 / m.expectedWorkdays);
  });
  it("months desc", () => expect(attendanceMonths(recs)).toEqual(["2024-06", "2024-05"]));
  it("alerts", () => {
    expect(attendanceAlerts({ yearMonth: "x", workedDays: 20, expectedWorkdays: 20, attendanceRate: 1, totalWorkedMinutes: 0, totalOvertimeMinutes: 46 * 60, averageWorkedMinutes: 0, paidLeaveDays: 0 })).toContain("残業が月間上限を超えています");
    expect(attendanceAlerts({ yearMonth: "x", workedDays: 20, expectedWorkdays: 20, attendanceRate: 1, totalWorkedMinutes: 0, totalOvertimeMinutes: 0, averageWorkedMinutes: 0, paidLeaveDays: 0 })).toHaveLength(0);
  });
});
