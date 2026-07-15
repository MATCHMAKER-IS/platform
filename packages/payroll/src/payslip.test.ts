import { describe, it, expect } from "vitest";
import { buildPayslip } from "./payslip.js";
import { calcPay } from "./premium.js";
describe("payslip", () => {
  it("assembles gross, deductions, net", () => {
    const bd = calcPay({ hourlyWage: 1000, totalMinutes: 600, overtimeMinutes: 120, nightMinutes: 0, holidayMinutes: 0 });
    const slip = buildPayslip(bd, { allowances: [{ name: "通勤手当", amount: 10000 }], deductions: [{ name: "健康保険", amount: 5000 }, { name: "厚生年金", amount: 9000 }] });
    expect(slip.grossPay).toBe(20500);
    expect(slip.totalDeductions).toBe(14000);
    expect(slip.netPay).toBe(6500);
  });
});
