import { describe, it, expect } from "vitest";
import { computeShares, donutSegments, achievementRate, funnelStages, relativeTime } from "./dashboard.js";
describe("dashboard viz logic", () => {
  it("computes shares", () => {
    const sh = computeShares([30, 50, 20]);
    expect(sh[0]!.ratio).toBe(0.3);
    expect(sh[1]!.percent).toBe(50);
    expect(computeShares([0, 0]).every((s) => s.ratio === 0)).toBe(true);
    expect(computeShares([-10, 10])[0]!.value).toBe(0);
  });
  it("computes donut segments (dasharray/offset)", () => {
    const C = 2 * Math.PI * 50;
    const seg = donutSegments([25, 75], 50);
    expect(Math.abs(seg[0]!.dash - 0.25 * C)).toBeLessThan(0.01);
    expect(seg[0]!.offset).toBe(0);
    expect(Math.abs(seg[1]!.offset - -0.25 * C)).toBeLessThan(0.01);
  });
  it("computes achievement rate", () => {
    expect(achievementRate(80, 100)).toBe(80);
    expect(achievementRate(120, 100)).toBe(120);
    expect(achievementRate(50, 0)).toBe(0);
  });
  it("computes funnel stages", () => {
    const fn = funnelStages([{ label: "申込", value: 1000 }, { label: "審査", value: 600 }, { label: "承認", value: 450 }]);
    expect(fn[1]!.ratioToFirst).toBe(0.6);
    expect(fn[2]!.conversionFromPrev).toBe(0.75);
    expect(fn[1]!.dropoff).toBe(400);
  });
  it("formats relative time (ja)", () => {
    const now = new Date("2025-07-25T12:00:00Z").getTime();
    expect(relativeTime(now - 30_000, now)).toBe("たった今");
    expect(relativeTime(now - 5 * 60_000, now)).toBe("5分前");
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe("3時間前");
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe("2日前");
    expect(relativeTime(now - 10 * 86_400_000, now)).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
  });
});
