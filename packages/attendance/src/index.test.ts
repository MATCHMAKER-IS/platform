import { describe, it, expect } from "vitest";
import { toDay, summarize, createMemoryAttendanceStore } from "./core";
import { statutoryLeaveDays, grantsSinceHire, leaveBalance, mandatoryLeaveStatus } from "./leave";

describe("toDay", () => {
  it("遅刻・残業を出す", () => {
    const d = toDay({ date: "2026-07-22", clockIn: "09:15", clockOut: "20:00", breakMinutes: 60 });
    expect(d.lateMinutes).toBe(15);
    expect(d.overtimeMinutes).toBeGreaterThan(0);
  });

  it("退勤が出勤より前なら翌日にまたいだ勤務として扱う(夜勤)", () => {
    const d = toDay({ date: "2026-07-22", clockIn: "22:00", clockOut: "06:00", breakMinutes: 60 });
    expect(d.totalMinutes).toBe(420);
    expect(d.nightMinutes).toBeGreaterThan(0);
  });

  it("休日勤務では遅刻・早退を判定しない(所定が存在しないため)", () => {
    const d = toDay({ date: "2026-07-23", clockIn: "10:00", clockOut: "15:00", isHoliday: true });
    expect(d.lateMinutes).toBe(0);
    expect(d.earlyLeaveMinutes).toBe(0);
    expect(d.holidayMinutes).toBeGreaterThan(0);
  });

  it("猶予の範囲なら遅刻にしない", () => {
    const d = toDay({ date: "2026-07-22", clockIn: "09:05", clockOut: "18:00" }, { graceMinutes: 10 });
    expect(d.lateMinutes).toBe(0);
  });
});

describe("summarize / store", () => {
  it("月次で合計し、出勤日数を数える", async () => {
    const store = createMemoryAttendanceStore();
    await store.record("u1", { date: "2026-07-01", clockIn: "09:00", clockOut: "18:00", breakMinutes: 60 });
    await store.record("u1", { date: "2026-07-02", clockIn: "09:00", clockOut: "20:00", breakMinutes: 60 });
    const s = await store.monthly("u1", "2026-07");
    expect(s.workedDays).toBe(2);
    expect(s.overtimeMinutes).toBeGreaterThan(0);
  });

  it("同じ日の打刻は上書きする(打ち直しを許す)", async () => {
    const store = createMemoryAttendanceStore();
    await store.record("u1", { date: "2026-07-01", clockIn: "09:00", clockOut: "18:00" });
    await store.record("u1", { date: "2026-07-01", clockIn: "09:00", clockOut: "19:00" });
    expect((await store.list("u1")).length).toBe(1);
  });
});

describe("有給", () => {
  it("法定付与は 6か月で10日、以降1年ごとに増え20日で頭打ち", () => {
    expect(statutoryLeaveDays(0.4)).toBe(0);
    expect(statutoryLeaveDays(0.5)).toBe(10);
    expect(statutoryLeaveDays(1.5)).toBe(11);
    expect(statutoryLeaveDays(10)).toBe(20);
  });

  it("初回は入社6か月後、その後は1年ごとに付与する", () => {
    const g = grantsSinceHire("2024-04-01", "2026-07-22");
    expect(g.map((x) => x.grantedOn)).toEqual(["2024-10-01", "2025-10-01"]);
    expect(g[0].expiresOn).toBe("2026-10-01"); // 時効は2年
  });

  it("古い付与から消化する(新しい分から使うと時効で捨てる分が増える)", () => {
    const grants = grantsSinceHire("2024-04-01", "2026-07-22");
    const b = leaveBalance(grants, [{ date: "2025-01-10", days: 3 }, { date: "2026-05-01", days: 2 }], "2026-07-22");
    expect(b.taken).toBe(5);
    expect(b.remaining).toBe(16);
    expect(b.nextExpiry?.date).toBe("2026-10-01");
  });

  it("年5日の取得義務の不足を出す", () => {
    const grants = grantsSinceHire("2024-04-01", "2026-07-22");
    const last = grants[grants.length - 1];
    const m = mandatoryLeaveStatus(last, [{ date: "2026-05-01", days: 2 }], "2026-07-22");
    expect(m.required).toBe(true);
    expect(m.shortage).toBe(3);
  });
});
