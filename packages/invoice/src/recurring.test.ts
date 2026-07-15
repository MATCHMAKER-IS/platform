import { describe, it, expect } from "vitest";
import { billingDateAt, nextBillingDate, billingDatesBetween, dueForBilling } from "./recurring.js";
import { dunningLevel, dunningMessage, shouldSendDunning } from "./dunning.js";
describe("invoice recurring", () => {
  it("computes billing dates (month-end clamp)", () => {
    expect(billingDateAt({ interval: "monthly", startDate: "2025-01-31" }, 1)).toBe("2025-02-28");
    const q = { interval: "quarterly" as const, startDate: "2025-01-15", endDate: "2025-12-31" };
    expect(billingDateAt(q, 2)).toBe("2025-07-15");
    expect(nextBillingDate(q, "2025-03-01")).toBe("2025-04-15");
    expect(nextBillingDate({ interval: "monthly", startDate: "2025-01-01", endDate: "2025-03-31" }, "2025-05-01")).toBeNull();
    expect(billingDatesBetween(q, "2025-01-01", "2025-12-31")).toEqual(["2025-01-15", "2025-04-15", "2025-07-15", "2025-10-15"]);
    expect(dueForBilling({ interval: "monthly", startDate: "2025-01-01" }, "2025-02-05", "2025-01-01")).toBe(true);
  });
});
describe("invoice dunning", () => {
  it("levels and messages", () => {
    expect(dunningLevel(5)).toBe("reminder");
    expect(dunningLevel(45)).toBe("second");
    expect(dunningLevel(90)).toBe("final");
    const inv = { number: "INV-001", billTo: "株式会社テスト", dueDate: "2025-06-30", amountDue: 110000 };
    expect(dunningMessage(inv, "first")).toContain("INV-001");
    expect(dunningMessage(inv, "final")).toContain("最終");
    expect(shouldSendDunning(20, []).send).toBe(true);
    expect(shouldSendDunning(20, ["first"]).send).toBe(false);
  });
});
