import { describe, it, expect } from "vitest";
import { computeDiscount, applyDiscount, isCouponApplicable } from "./discount.js";
describe("discount", () => {
  it("computes percentage/fixed with caps and thresholds", () => {
    expect(computeDiscount({ code: "X", type: "percentage", value: 10 }, 3000)).toBe(300);
    expect(computeDiscount({ code: "Y", type: "fixed", value: 500 }, 3000)).toBe(500);
    expect(computeDiscount({ code: "Z", type: "fixed", value: 500, minPurchase: 5000 }, 3000)).toBe(0);
    expect(computeDiscount({ code: "W", type: "percentage", value: 50, maxDiscount: 1000 }, 3000)).toBe(1000);
    expect(computeDiscount({ code: "V", type: "fixed", value: 9999 }, 3000)).toBe(3000);
    expect(applyDiscount(3000, { code: "X", type: "percentage", value: 10 })).toBe(2700);
    expect(isCouponApplicable({ code: "Z", type: "fixed", value: 1, minPurchase: 5000 }, 3000)).toBe(false);
  });
});
