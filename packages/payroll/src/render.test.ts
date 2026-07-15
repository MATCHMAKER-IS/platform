import { describe, it, expect } from "vitest";
import { renderPayslipHtml } from "./render.js";
describe("payroll render", () => {
  const payslip = { base: 250000, premiums: 30000, allowances: [{ name: "通勤手当", amount: 15000 }], grossPay: 295000, deductions: [{ name: "健康保険料", amount: 14000 }, { name: "源泉所得税", amount: 8000 }], totalDeductions: 22000, netPay: 273000 };
  it("renders payslip html", () => {
    const html = renderPayslipHtml(payslip, { employeeName: "山田太郎", period: "2025年7月分" });
    expect(html).toContain("山田太郎 様");
    expect(html).toContain("¥250,000");
    expect(html).toContain("通勤手当");
    expect(html).toContain("¥273,000");
    expect(renderPayslipHtml({ ...payslip, allowances: [{ name: "<b>x</b>", amount: 1 }] })).toContain("&lt;b&gt;");
  });
});
