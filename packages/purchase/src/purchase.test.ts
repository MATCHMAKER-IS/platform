import { describe, it, expect } from "vitest";
import { buildPurchaseOrder } from "./purchase-order";
import { receivingStatus, totalOutstanding, purchaseStatus, overReceivedLines } from "./receiving";
describe("purchase", () => {
  const lines = [{ description: "部品A", quantity: 100, unitPrice: 500 }, { description: "部品B", quantity: 50, unitPrice: 200, taxRate: 8 as const }];
  const po = buildPurchaseOrder({ number: "PO-0001", orderDate: "2025-07-01", supplier: "仕入先", state: "ordered" }, lines);
  it("totals and receiving", () => {
    expect(po.totals.total).toBe(65800);
    const receipts = [{ lineIndex: 0, quantity: 80, receivedAt: "x" }];
    const st = receivingStatus(lines, receipts);
    expect(st[0]!.outstanding).toBe(20);
    expect(totalOutstanding(lines, receipts)).toBe(70);
    expect(purchaseStatus(po, receipts)).toBe("partially_received");
    expect(purchaseStatus(po, [{ lineIndex: 0, quantity: 100, receivedAt: "x" }, { lineIndex: 1, quantity: 50, receivedAt: "x" }])).toBe("received");
    expect(overReceivedLines(lines, [{ lineIndex: 1, quantity: 60, receivedAt: "x" }])).toEqual([1]);
  });
});
