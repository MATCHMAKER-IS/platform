import { describe, it, expect } from "vitest";
import { calcPay, aggregateMonthly } from "./premium";
const w = 1000;
describe("premium pay (labor standards)", () => {
  it("applies compound premium rates", () => {
    expect(calcPay({ hourlyWage: w, totalMinutes: 480, overtimeMinutes: 0, nightMinutes: 0, holidayMinutes: 0 }).total).toBe(8000);
    expect(calcPay({ hourlyWage: w, totalMinutes: 600, overtimeMinutes: 120, nightMinutes: 0, holidayMinutes: 0 }).total).toBe(10500); // +25%
    expect(calcPay({ hourlyWage: w, totalMinutes: 120, overtimeMinutes: 120, nightMinutes: 120, holidayMinutes: 0 }).total).toBe(3000); // 1.5x
    expect(calcPay({ hourlyWage: w, totalMinutes: 480, overtimeMinutes: 0, nightMinutes: 0, holidayMinutes: 480 }).total).toBe(10800); // 1.35x
    expect(calcPay({ hourlyWage: w, totalMinutes: 120, overtimeMinutes: 0, nightMinutes: 120, holidayMinutes: 120 }).total).toBe(3200); // 1.6x
  });
  it("applies over-60h monthly overtime premium", () => {
    const r = calcPay({ hourlyWage: w, totalMinutes: 70 * 60, overtimeMinutes: 70 * 60, nightMinutes: 0, holidayMinutes: 0, over60Minutes: 10 * 60 });
    expect(r.overtimePremium).toBe(15000);
    expect(r.over60Premium).toBe(5000);
  });
  it("aggregates monthly and derives over-60h", () => {
    const days = Array.from({ length: 22 }, () => ({ totalMinutes: 660, overtimeMinutes: 180, nightMinutes: 0, holidayMinutes: 0 }));
    const m = aggregateMonthly(days);
    expect(m.overtimeMinutes).toBe(66 * 60);
    expect(m.over60Minutes).toBe(6 * 60);
    expect(m.workedDays).toBe(22);
  });
});
