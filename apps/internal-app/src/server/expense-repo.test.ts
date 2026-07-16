import { describe, it, expect } from "vitest";
import { prismaExpenseToExpense, expenseToCreateData } from "./expense-repo";

describe("expense repo mapping", () => {
  it("prisma -> expense", () => {
    const e = prismaExpenseToExpense({ id: "x1", date: new Date("2024-04-03T00:00:00Z"), category: "交通費", amount: 1240, note: null });
    expect(e).toEqual({ id: "x1", date: "2024-04-03", category: "交通費", amount: 1240, note: undefined });
  });
  it("keeps note", () => { const e = prismaExpenseToExpense({ id: "x2", date: new Date("2024-12-31T00:00:00Z"), category: "会議費", amount: 8600, note: "打合せ" }); expect(e.note).toBe("打合せ"); });
  it("expense -> create data", () => {
    const cd = expenseToCreateData({ id: "i1", date: "2024-05-02", category: "消耗品", amount: 5000 });
    expect(cd.date.toISOString().slice(0, 10)).toBe("2024-05-02");
    expect(cd.note).toBeNull();
  });
});
