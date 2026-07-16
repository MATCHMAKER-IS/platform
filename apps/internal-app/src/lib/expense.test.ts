import { describe, it, expect } from "vitest";
import { summarize, monthKey, quarterKey, totalByCategory, outlierExpenses, type Expense } from "./expense";

const data: Expense[] = [
  { id: "1", date: "2024-01-05", category: "交通費", amount: 1200 },
  { id: "2", date: "2024-01-20", category: "会議費", amount: 8000 },
  { id: "3", date: "2024-02-10", category: "交通費", amount: 1500 },
  { id: "4", date: "2024-02-15", category: "消耗品", amount: 3000 },
  { id: "5", date: "2024-03-01", category: "会議費", amount: 120000 },
  { id: "6", date: "2024-03-10", category: "交通費", amount: 1300 },
];

describe("expense summary", () => {
  it("total/count", () => { const s = summarize(data); expect(s.total).toBe(135000); expect(s.count).toBe(6); });
  it("byMonth ascending", () => { const s = summarize(data); expect(s.byMonth.map((m) => m.month)).toEqual(["2024-01", "2024-02", "2024-03"]); expect(s.byMonth[0].total).toBe(9200); });
  it("byCategory desc + share", () => { const c = totalByCategory(data); expect(c[0].category).toBe("会議費"); expect(Math.abs(c[0].share - 128000 / 135000)).toBeLessThan(1e-9); });
  it("outliers", () => { expect(outlierExpenses(data).map((e) => e.id)).toEqual(["5"]); });
  it("keys", () => { expect(monthKey("2024-02-10")).toBe("2024-02"); expect(quarterKey("2024-11-01")).toBe("2024-Q4"); });
});
