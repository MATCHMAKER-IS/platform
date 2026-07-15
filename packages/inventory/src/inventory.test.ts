import { describe, it, expect } from "vitest";
import { onHand, summarize, applyMovement, type StockMovement } from "./movements.js";
import { reorderPoint, needsReorder, reorderQuantity } from "./reorder.js";
import { movingAverage } from "./valuation.js";
describe("inventory movements", () => {
  const mv: StockMovement[] = [
    { type: "inbound", quantity: 100, at: "2025-07-01", unitCost: 500 },
    { type: "outbound", quantity: 30, at: "2025-07-05" },
    { type: "inbound", quantity: 50, at: "2025-07-10", unitCost: 600 },
    { type: "adjustment", quantity: -5, at: "2025-07-15" },
  ];
  it("computes on-hand and summary", () => {
    expect(onHand(mv)).toBe(115);
    const s = summarize(mv);
    expect(s.totalIn).toBe(150);
    expect(s.totalOut).toBe(30);
    expect(s.onHand).toBe(115);
    expect(applyMovement([{ type: "inbound", quantity: 10, at: "x" }], { type: "outbound", quantity: 20, at: "y" }).ok).toBe(false);
  });
});
describe("inventory reorder & valuation", () => {
  const policy = { safetyStock: 20, dailyDemand: 5, leadTimeDays: 7 };
  it("reorder point and quantity", () => {
    expect(reorderPoint(policy)).toBe(55);
    expect(needsReorder(55, policy)).toBe(true);
    expect(reorderQuantity(30, policy)).toBe(80);
    expect(reorderQuantity(56, policy)).toBe(0);
  });
  it("moving average valuation", () => {
    const v = movingAverage([{ type: "inbound", quantity: 100, at: "a", unitCost: 500 }, { type: "outbound", quantity: 30, at: "b" }, { type: "inbound", quantity: 50, at: "c", unitCost: 600 }]);
    expect(v.onHand).toBe(120);
    expect(Math.abs(v.averageCost - 541.67)).toBeLessThan(0.01);
    expect(v.value).toBe(65000);
  });
});
