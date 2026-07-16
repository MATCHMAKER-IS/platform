import { describe, it, expect } from "vitest";
import { parseExpenseCsv, toExpenses, normalizeDateStr, EXPENSE_IMPORT_FIELDS } from "./expense-import";

const csv = `日付,カテゴリ,金額,備考
2024/1/5,交通費,"1,200",客先訪問
2024-02-10,会議費,¥8000,
2024.03.01,消耗品,3000,棚卸`;

describe("expense import", () => {
  it("normalizes headers and dates", () => {
    const rows = parseExpenseCsv(csv);
    expect(Object.keys(rows[0]).sort()).toEqual(["amount", "category", "date", "note"]);
    expect(rows[0].date).toBe("2024-01-05");
    expect(rows[2].date).toBe("2024-03-01");
  });
  it("converts to typed expenses", () => {
    const exp = toExpenses(parseExpenseCsv(csv));
    expect(exp[0].amount).toBe(1200);
    expect(exp[1].amount).toBe(8000);
    expect(exp[1].note).toBeUndefined();
    expect(exp[0].id).toBe("imp-1");
  });
  it("normalizeDateStr", () => { expect(normalizeDateStr("2024/12/31")).toBe("2024-12-31"); expect(normalizeDateStr("bad")).toBe("bad"); });
  it("field defs", () => { expect(EXPENSE_IMPORT_FIELDS).toHaveLength(4); expect(EXPENSE_IMPORT_FIELDS[2].required).toBe(true); });
});
