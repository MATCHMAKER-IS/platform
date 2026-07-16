import { describe, it, expect } from "vitest";
import { buildOrderSummary, qualifiesForFreeShipping, resolveShippingFee, amountUntilFreeShipping } from "./order-summary";
describe("order summary", () => {
  it("computes exclusive/inclusive tax and totals", () => {
    expect(buildOrderSummary({ subtotal: 3000, taxRate: 10 })).toMatchObject({ tax: 300, total: 3300 });
    expect(buildOrderSummary({ subtotal: 3000, discount: 500, shippingFee: 550, taxRate: 10 })).toMatchObject({ discountedSubtotal: 2500, tax: 250, total: 3300 });
    expect(buildOrderSummary({ subtotal: 3300, taxRate: 10, taxMode: "inclusive" })).toMatchObject({ tax: 300, total: 3300 });
    expect(buildOrderSummary({ subtotal: 3000, taxRate: 8 }).tax).toBe(240);
  });
  it("resolves free shipping", () => {
    expect(qualifiesForFreeShipping(5000, 5000)).toBe(true);
    expect(resolveShippingFee(3000, 5000, 550)).toBe(550);
    expect(amountUntilFreeShipping(3000, 5000)).toBe(2000);
  });
});
