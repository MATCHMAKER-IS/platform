import { describe, it, expect } from "vitest";
import { parseTimeToMinutes, nightMinutes, splitDailyWork } from "./worktime.js";
const t = parseTimeToMinutes;
describe("worktime split", () => {
  it("parses time and night window", () => {
    expect(t("09:00")).toBe(540);
    expect(nightMinutes(t("22:00"), 1440)).toBe(120);
    expect(nightMinutes(t("20:00"), 1440 + t("06:00"))).toBe(420);
    expect(nightMinutes(t("09:00"), t("18:00"))).toBe(0);
  });
  it("splits regular/overtime/holiday", () => {
    expect(splitDailyWork({ startMin: t("09:00"), endMin: t("18:00"), breakMinutes: 60 })).toMatchObject({ totalMinutes: 480, overtimeMinutes: 0 });
    expect(splitDailyWork({ startMin: t("09:00"), endMin: t("20:00"), breakMinutes: 60 }).overtimeMinutes).toBe(120);
    expect(splitDailyWork({ startMin: t("09:00"), endMin: t("18:00"), breakMinutes: 60, isHoliday: true })).toMatchObject({ holidayMinutes: 480, overtimeMinutes: 0 });
  });
});
