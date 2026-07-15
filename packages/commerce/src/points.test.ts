import { describe, it, expect } from "vitest";
import { earnPoints, pointsBalance, redeemPoints, expiringPoints } from "./points.js";
const now = new Date("2025-07-25T00:00:00Z");
describe("points", () => {
  it("earns, balances, redeems", () => {
    expect(earnPoints(1980)).toBe(19);
    const txns = [
      { amount: 100, date: "2025-01-01T00:00:00Z", expiresAt: "2026-01-01T00:00:00Z" },
      { amount: 50, date: "2025-02-01T00:00:00Z", expiresAt: "2025-06-01T00:00:00Z" },
      { amount: -30, date: "2025-03-01T00:00:00Z" },
    ];
    expect(pointsBalance(txns, now)).toBe(70);
    expect(redeemPoints(500, 300, 200)).toMatchObject({ used: 200, remaining: 300 });
    expect(redeemPoints(0, 100).ok).toBe(false);
    expect(expiringPoints([{ amount: 100, date: "x", expiresAt: "2025-08-15T00:00:00Z" }], new Date("2025-09-01"), now)).toBe(100);
  });
});
