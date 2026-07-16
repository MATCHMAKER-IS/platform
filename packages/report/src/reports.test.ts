import { describe, it, expect } from "vitest";
import { trialBalanceSheet, agingSheet, taxReportSheet, inventoryValuationSheet, combineSheets, sheetToCsv } from "./reports";
describe("report reports", () => {
  it("builds domain sheets", () => {
    const tb = trialBalanceSheet([{ account: "売掛金", debit: 110000, credit: 110000, balance: 0 }]);
    expect(tb.rows[tb.rows.length - 1]!.勘定科目).toBe("合計");
    expect(agingSheet({ current: 5000, d1_30: 20000, d31_60: 10000, d61_90: 0, over90: 0, total: 35000 }).rows).toHaveLength(6);
    expect(taxReportSheet({ byRate: [{ rate: 10, salesNet: 100000, outputTax: 10000, purchaseNet: 60000, inputTax: 6000 }], outputTax: 10000, inputTax: 6000, netPayable: 4000 }).rows[2]!.仮受消費税).toBe(4000);
    expect(inventoryValuationSheet([{ item: "A", onHand: 120, averageCost: 500, value: 60000 }]).rows[1]!.在庫金額).toBe(60000);
    expect(combineSheets(tb, { name: "空", rows: [], freezeHeader: true })).toHaveLength(1);
    expect(sheetToCsv(agingSheet({ current: 5000, d1_30: 0, d31_60: 0, d61_90: 0, over90: 0, total: 5000 })).split("\n")[0]).toBe("区分,金額");
  });
});
