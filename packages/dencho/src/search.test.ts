import { describe, it, expect } from "vitest";
import { searchTransactions, meetsSearchRequirements } from "./search.js";
const txns = [
  { id: "1", transactionDate: "2025-07-01", amount: 11000, counterparty: "山田商事" },
  { id: "2", transactionDate: "2025-07-15", amount: 55000, counterparty: "鈴木工業" },
  { id: "3", transactionDate: "2025-08-01", amount: 33000, counterparty: "山田物産" },
];
describe("dencho search (visibility)", () => {
  it("filters by date/amount/counterparty and AND", () => {
    expect(searchTransactions(txns, { dateFrom: "2025-07-01", dateTo: "2025-07-31" }).map((r) => r.id)).toEqual(["1", "2"]);
    expect(searchTransactions(txns, { amountMin: 30000, amountMax: 60000 }).map((r) => r.id)).toEqual(["2", "3"]);
    expect(searchTransactions(txns, { counterparty: "山田" }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(searchTransactions(txns, { dateTo: "2025-07-31", counterparty: "山田" }).map((r) => r.id)).toEqual(["1"]);
  });
  it("self-checks search requirements", () => {
    expect(meetsSearchRequirements({ dateFrom: "2025-07-01" }).ok).toBe(true);
    expect(meetsSearchRequirements({}).ok).toBe(false);
  });
});
