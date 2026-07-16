import { describe, it, expect } from "vitest";
import { stock, inStock, isOutOfStock, reserveStock, releaseStock, commitStock, canFulfill } from "./inventory";
describe("inventory", () => {
  it("checks and reserves stock", () => {
    const lv = stock(10);
    expect(inStock(lv, 5)).toBe(true);
    expect(isOutOfStock(stock(0))).toBe(true);
    const r = reserveStock(lv, 3);
    expect(r).toMatchObject({ ok: true, level: { available: 7, reserved: 3 } });
    expect(reserveStock(lv, 20).ok).toBe(false);
    expect(releaseStock(r.level, 1).level).toMatchObject({ available: 8, reserved: 2 });
    expect(commitStock(r.level, 3).level).toMatchObject({ available: 7, reserved: 0 });
  });
  it("checks cart fulfillment", () => {
    const check = canFulfill({ A: 5, B: 0, C: 10 }, [{ productId: "A", quantity: 3 }, { productId: "B", quantity: 1 }, { productId: "C", quantity: 20 }]);
    expect(check.ok).toBe(false);
    expect(check.shortages).toHaveLength(2);
    expect(canFulfill({ A: 5 }, [{ productId: "A", quantity: 5 }]).ok).toBe(true);
  });
});
