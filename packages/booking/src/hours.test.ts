import { describe, it, expect } from "vitest";
import { timeToMinutes, minutesToTime, weekdayOf, resolveDayHours, isBusinessDay, isOpenAt } from "./hours.js";
const weekly = { 1: [{ open: "09:00", close: "12:00" }, { open: "13:00", close: "18:00" }], 0: [] };
describe("booking hours", () => {
  it("converts time and resolves day hours", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30");
    expect(weekdayOf("2025-07-28")).toBe(1);
    expect(resolveDayHours("2025-07-28", weekly)).toHaveLength(2);
    expect(resolveDayHours("2025-07-28", weekly, { closedDates: ["2025-07-28"] })).toHaveLength(0);
    expect(resolveDayHours("2025-07-28", weekly, { specialDates: { "2025-07-28": [{ open: "10:00", close: "15:00" }] } })[0]!.open).toBe("10:00");
  });
  it("checks business day and open time", () => {
    expect(isBusinessDay("2025-07-28", weekly)).toBe(true);
    expect(isBusinessDay("2025-07-27", weekly)).toBe(false);
    expect(isOpenAt("2025-07-28", "12:30", weekly)).toBe(false);
    expect(isOpenAt("2025-07-28", "10:00", weekly)).toBe(true);
  });
});
