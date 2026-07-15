import { describe, it, expect } from "vitest";
import { isBalanced, debitTotal, trialBalance, trialBalanceBalanced, toFreeeDetails } from "./journal.js";
import { salesJournal, purchaseJournal, receiptJournal, DEFAULT_ACCOUNTS } from "./entries.js";
describe("accounting", () => {
  it("builds balanced journals", () => {
    const sales = salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 });
    expect(sales.lines[0]!.debit).toBe(110000);
    expect(isBalanced(sales)).toBe(true);
    expect(debitTotal(sales)).toBe(110000);
    const purchase = purchaseJournal({ date: "2025-07-02", net: 60000, tax: 6000 });
    expect(purchase.lines[2]!.credit).toBe(66000);
    expect(isBalanced(purchase)).toBe(true);
  });
  it("trial balance and freee conversion", () => {
    const sales = salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 });
    const tb = trialBalance([sales, receiptJournal({ date: "2025-07-31", amount: 110000 })]);
    expect(tb.find((a) => a.account === "売掛金")!.balance).toBe(0);
    expect(trialBalanceBalanced([sales])).toBe(true);
    expect(toFreeeDetails(sales)).toHaveLength(3);
    expect(salesJournal({ date: "x", net: 1, tax: 0 }, { ...DEFAULT_ACCOUNTS, sales: "売上収益" }).lines[1]!.account).toBe("売上収益");
  });
});

import { filterByPeriod, profitAndLoss, balanceSheet } from "./closing.js";
import { consumptionTaxSummary } from "./tax-report.js";
describe("accounting closing & tax-report", () => {
  const entries = [
    salesJournal({ date: "2025-07-05", net: 100000, tax: 10000 }),
    purchaseJournal({ date: "2025-07-10", net: 60000, tax: 6000 }),
    salesJournal({ date: "2025-08-03", net: 50000, tax: 5000 }),
  ];
  it("monthly P&L and balance sheet", () => {
    const jul = filterByPeriod(entries, "2025-07");
    expect(jul).toHaveLength(2);
    const pl = profitAndLoss(jul);
    expect(pl.netIncome).toBe(40000);
    const bs = balanceSheet(jul);
    expect(bs.assets).toBe(116000);
    expect(bs.equity).toBe(40000);
    expect(pl.netIncome).toBe(bs.equity);
  });
  it("consumption tax summary", () => {
    const r = consumptionTaxSummary([{ rate: 10, net: 100000, tax: 10000 }, { rate: 8, net: 20000, tax: 1600 }], [{ rate: 10, net: 60000, tax: 6000 }]);
    expect(r.outputTax).toBe(11600);
    expect(r.inputTax).toBe(6000);
    expect(r.netPayable).toBe(5600);
    expect(consumptionTaxSummary([{ rate: 10, net: 10000, tax: 1000 }], [{ rate: 10, net: 50000, tax: 5000 }]).netPayable).toBe(-4000);
  });
});

import { journalToRows, journalToFreeeDetails } from "./export.js";
describe("accounting export", () => {
  it("flattens to CSV rows and freee details", () => {
    const entries = [salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 }), receiptJournal({ date: "2025-07-31", amount: 110000 })];
    const rows = journalToRows(entries);
    expect(rows).toHaveLength(5);
    expect(rows[0]!.account).toBe("売掛金");
    expect(rows[0]!.debit).toBe(110000);
    const ids = { 売掛金: 100, 売上高: 200, 仮受消費税: 300, 現金預金: 400 };
    const conv = journalToFreeeDetails(salesJournal({ date: "x", net: 100000, tax: 10000 }), ids);
    expect(conv.details).toHaveLength(3);
    expect(conv.details[0]!.accountItemId).toBe(100);
    expect(journalToFreeeDetails(purchaseJournal({ date: "x", net: 1, tax: 0 }), ids).unknownAccounts).toContain("仕入高");
  });
});

import { payrollJournal } from "./entries.js";
import { departmentSummary, profitAndLossByDepartment } from "./closing.js";
import { prepareBatch, entryKey, syncJournals, summarizeSync } from "./sync.js";
describe("accounting payroll & department", () => {
  it("payroll journal balanced", () => {
    const pay = payrollJournal({ date: "2025-07-25", gross: 300000, withholdingTax: 10000, socialInsurance: 45000 });
    expect(pay.lines[0]!.debit).toBe(300000);
    expect(pay.lines[3]!.credit).toBe(245000);
    expect(isBalanced(pay)).toBe(true);
    expect(payrollJournal({ date: "x", gross: 100000, withholdingTax: 0, socialInsurance: 0, paid: true }).lines[3]!.account).toBe("現金預金");
  });
  it("department P&L", () => {
    const entries = [
      { date: "2025-07-01", description: "売上", lines: [{ account: "売掛金", debit: 110000, credit: 0 }, { account: "売上高", debit: 0, credit: 100000, department: "営業部" }] },
      { date: "2025-07-02", description: "経費", lines: [{ account: "旅費交通費", debit: 20000, credit: 0, department: "営業部" }] },
    ];
    expect(departmentSummary(entries)).toHaveLength(1);
    expect(profitAndLossByDepartment(entries)["営業部"]!.netIncome).toBe(80000);
  });
});
describe("accounting sync", () => {
  const ids = { 売掛金: 100, 売上高: 200, 仮受消費税: 300, 現金預金: 400 };
  it("prepares and syncs idempotently", async () => {
    const entries = [salesJournal({ date: "2025-07-01", net: 100000, tax: 10000 }), receiptJournal({ date: "2025-07-31", amount: 110000 })];
    expect(prepareBatch(entries, ids).ready).toHaveLength(2);
    expect(prepareBatch([purchaseJournal({ date: "x", net: 100, tax: 10 })], ids).errors).toHaveLength(1);
    const r = await syncJournals(entries, { send: async () => ({ ok: true }), accountItemIds: ids });
    expect(summarizeSync(r.results).sent).toBe(2);
    const r2 = await syncJournals(entries, { send: async () => ({ ok: true }), accountItemIds: ids, alreadySent: new Set([entryKey(entries[0]!)]) });
    expect(summarizeSync(r2.results).skipped).toBe(1);
    const r3 = await syncJournals(entries, { send: async () => ({ ok: false, error: "e" }), accountItemIds: ids });
    expect(summarizeSync(r3.results).failed).toBe(2);
  });
});
