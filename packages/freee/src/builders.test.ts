import { describe, it, expect } from "vitest";
import { buildManualJournal } from "./builders";
describe("freee manual journal builder", () => {
  it("builds balanced journal", () => {
    const mj = buildManualJournal({ companyId: 1, issueDate: "2025-07-11", details: [
      { entrySide: "debit", accountItemId: 100, taxCode: 0, amount: 11000 },
      { entrySide: "credit", accountItemId: 200, taxCode: 0, amount: 11000 },
    ] });
    expect((mj.details as unknown[]).length).toBe(2);
  });
  it("rejects unbalanced or too few details", () => {
    expect(() => buildManualJournal({ companyId: 1, issueDate: "x", details: [
      { entrySide: "debit", accountItemId: 1, taxCode: 0, amount: 100 },
      { entrySide: "credit", accountItemId: 2, taxCode: 0, amount: 200 },
    ] })).toThrow();
    expect(() => buildManualJournal({ companyId: 1, issueDate: "x", details: [
      { entrySide: "debit", accountItemId: 1, taxCode: 0, amount: 100 },
    ] })).toThrow();
  });
});
