import { describe, it, expect } from "vitest";
import { buildMonthlyReport, availableMonths, toExpenseRecords } from "./expense-report.js";
import type { Expense } from "./expense.js";

const exp: Expense[] = [
  { id: "1", date: "2024-04-03", category: "交通費", amount: 1240 },
  { id: "2", date: "2024-04-12", category: "会議費", amount: 8600 },
  { id: "3", date: "2024-04-18", category: "交通費", amount: 3200 },
  { id: "4", date: "2024-05-02", category: "消耗品", amount: 5000 },
];

describe("expense report", () => {
  it("availableMonths desc", () => expect(availableMonths(exp)).toEqual(["2024-05", "2024-04"]));
  it("toExpenseRecords maps amount/taxRate", () => { const r = toExpenseRecords(exp); expect(r[0].amount).toBe(1240); expect(r[0].taxRate).toBe(10); });
  it("monthly summary", () => { const rep = buildMonthlyReport(exp, "2024-04", { locale: "ja" }); expect(rep.summary.count).toBe(3); expect(rep.summary.total).toBe(13040); expect(rep.summary.byCategory[0].category).toBe("会議費"); });
  it("html + sheets", () => { const rep = buildMonthlyReport(exp, "2024-04"); expect(rep.html).toContain("13,040"); expect(rep.sheets.length).toBeGreaterThan(0); });
  it("empty month", () => expect(buildMonthlyReport(exp, "2024-12").summary.count).toBe(0));
});
