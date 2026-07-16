import { describe, it, expect } from "vitest";
import { workedMinutes, overtimeMinutes, hhmmToMinutes, formatWorked, summarizeAttendance, type AttendanceRecord } from "./attendance";

describe("attendance", () => {
  it("worked/overtime", () => {
    expect(workedMinutes({ date: "x", clockIn: "09:00", clockOut: "18:00" })).toBe(480);
    expect(overtimeMinutes({ date: "x", clockIn: "09:00", clockOut: "20:00" })).toBe(120);
  });
  it("break + night shift", () => {
    expect(workedMinutes({ date: "x", clockIn: "09:00", clockOut: "18:00", breakMinutes: 45 })).toBe(495);
    expect(workedMinutes({ date: "x", clockIn: "22:00", clockOut: "06:00" })).toBe(420);
  });
  it("invalid time -> 0", () => expect(workedMinutes({ date: "x", clockIn: "bad", clockOut: "18:00" })).toBe(0));
  it("hhmm/format", () => { expect(hhmmToMinutes("09:30")).toBe(570); expect(Number.isNaN(hhmmToMinutes("25:99"))).toBe(true); expect(formatWorked(510)).toBe("8時間30分"); });
  it("summary", () => {
    const recs: AttendanceRecord[] = [
      { date: "2024-05-01", clockIn: "09:00", clockOut: "18:00" },
      { date: "2024-05-02", clockIn: "09:00", clockOut: "20:00" },
    ];
    const s = summarizeAttendance(recs);
    expect(s.days).toBe(2); expect(s.totalWorkedMinutes).toBe(1080); expect(s.totalOvertimeMinutes).toBe(120); expect(s.averageWorkedMinutes).toBe(540);
  });
});
