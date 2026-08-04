import { describe, it, expect } from "vitest";
import {
  checkOvertimeLimits, remainingOvertime, DEFAULT_LIMITS, SPECIAL_CLAUSE_LIMITS,
  type MonthlyOvertime,
} from "./overtime-limit";

const H = 60;
const m = (month: string, overtime: number, holiday = 0): MonthlyOvertime =>
  ({ month, overtimeMinutes: overtime * H, holidayMinutes: holiday * H });

describe("単月の上限（100 時間未満）", () => {
  it("**ちょうど 100 時間は違反**（「未満」なので）", () => {
    const v = checkOvertimeLimits([m("2026-04", 100)]);
    expect(v.some((x) => x.kind === "single-month" && x.severity === "violation")).toBe(true);
  });

  it("99 時間 59 分は適法", () => {
    const v = checkOvertimeLimits([{ month: "2026-04", overtimeMinutes: 99 * H + 59, holidayMinutes: 0 }]);
    expect(v.some((x) => x.kind === "single-month" && x.severity === "violation")).toBe(false);
  });

  it("**休日労働を含めて**判定する", () => {
    // 時間外 60h + 休日 45h = 105h
    const v = checkOvertimeLimits([m("2026-04", 60, 45)]);
    expect(v.some((x) => x.kind === "single-month" && x.severity === "violation")).toBe(true);
  });

  it("上限に近づくと警告が出る（達してからでは遅い）", () => {
    const v = checkOvertimeLimits([m("2026-04", 92)]);
    expect(v.some((x) => x.kind === "single-month" && x.severity === "warning")).toBe(true);
  });
});

describe("複数月平均（80 時間以内）", () => {
  it("**ちょうど 80 時間は適法**（「以内」なので。単月とは扱いが違う）", () => {
    const v = checkOvertimeLimits([m("2026-04", 80), m("2026-05", 80)]);
    expect(v.some((x) => x.kind === "average")).toBe(false);
  });

  it("平均が 80 時間を 1 分でも超えると違反", () => {
    const v = checkOvertimeLimits([
      { month: "2026-04", overtimeMinutes: 80 * H, holidayMinutes: 0 },
      { month: "2026-05", overtimeMinutes: 80 * H + 2, holidayMinutes: 0 },
    ]);
    expect(v.some((x) => x.kind === "average" && x.severity === "violation")).toBe(true);
  });

  it("**どの区間を取っても**超えてはいけない（後半 2 か月だけ高い場合）", () => {
    const v = checkOvertimeLimits([m("2026-04", 20), m("2026-05", 95), m("2026-06", 95)]);
    // 3 か月平均は 70h で収まるが、5〜6 月の 2 か月平均は 95h
    expect(v.some((x) => x.kind === "average")).toBe(true);
  });
});

describe("年間の上限", () => {
  it("原則は年 360 時間", () => {
    const months = Array.from({ length: 12 }, (_, i) => m(`2026-${String(i + 1).padStart(2, "0")}`, 31));
    expect(checkOvertimeLimits(months).some((x) => x.kind === "yearly" && x.severity === "violation")).toBe(true);
  });

  it("特別条項があれば年 720 時間まで", () => {
    const months = Array.from({ length: 12 }, (_, i) => m(`2026-${String(i + 1).padStart(2, "0")}`, 31));
    expect(checkOvertimeLimits(months, SPECIAL_CLAUSE_LIMITS).some((x) => x.kind === "yearly" && x.severity === "violation")).toBe(false);
  });

  it("年間の判定には休日労働を含めない", () => {
    const months = Array.from({ length: 12 }, (_, i) => m(`2026-${String(i + 1).padStart(2, "0")}`, 25, 20));
    // 時間外だけなら 300h で上限内
    expect(checkOvertimeLimits(months).some((x) => x.kind === "yearly" && x.severity === "violation")).toBe(false);
  });
});

describe("月 45 時間を超えてよい回数", () => {
  it("6 回までは適法、7 回目で違反", () => {
    const six = Array.from({ length: 6 }, (_, i) => m(`2026-${String(i + 1).padStart(2, "0")}`, 50));
    const seven = Array.from({ length: 7 }, (_, i) => m(`2026-${String(i + 1).padStart(2, "0")}`, 50));
    expect(checkOvertimeLimits(six, SPECIAL_CLAUSE_LIMITS).some((x) => x.kind === "exceed-count" && x.severity === "violation")).toBe(false);
    expect(checkOvertimeLimits(seven, SPECIAL_CLAUSE_LIMITS).some((x) => x.kind === "exceed-count" && x.severity === "violation")).toBe(true);
  });

  it("6 回目で警告（次に超えると違反）", () => {
    const six = Array.from({ length: 6 }, (_, i) => m(`2026-${String(i + 1).padStart(2, "0")}`, 50));
    expect(checkOvertimeLimits(six, SPECIAL_CLAUSE_LIMITS).some((x) => x.kind === "exceed-count" && x.severity === "warning")).toBe(true);
  });
});

describe("remainingOvertime(あと何時間できるか)", () => {
  it("最も厳しい規制が効く", () => {
    const r = remainingOvertime([], m("2026-04", 40), SPECIAL_CLAUSE_LIMITS);
    expect(r.remainingMinutes).toBe(40 * H);
    expect(r.binding).toBe("average");
  });

  it("既に上限なら 0（負にはしない）", () => {
    const r = remainingOvertime([], m("2026-04", 120), SPECIAL_CLAUSE_LIMITS);
    expect(r.remainingMinutes).toBe(0);
  });

  it("過去の月が多いほど、残りは少なくなる", () => {
    const past = [m("2026-01", 90), m("2026-02", 90), m("2026-03", 90)];
    const a = remainingOvertime([], m("2026-04", 20), SPECIAL_CLAUSE_LIMITS);
    const b = remainingOvertime(past, m("2026-04", 20), SPECIAL_CLAUSE_LIMITS);
    expect(b.remainingMinutes).toBeLessThan(a.remainingMinutes);
  });
});

describe("空・境界", () => {
  it("データが無くても落ちない", () => {
    expect(checkOvertimeLimits([])).toEqual([]);
  });

  it("既定の上限は原則（月 45h・年 360h）", () => {
    expect(DEFAULT_LIMITS.monthlyMinutes).toBe(45 * H);
    expect(DEFAULT_LIMITS.yearlyMinutes).toBe(360 * H);
  });
});
