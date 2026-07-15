import { describe, it, expect } from "vitest";
import { withholdingTax, withholdingTaxFlat, applyWithholding } from "./withholding.js";
describe("withholding tax", () => {
  it("computes standard rate with 1M threshold (floored)", () => {
    expect(withholdingTax(100_000)).toBe(10_210);
    expect(withholdingTax(1_000_000)).toBe(102_100);
    expect(withholdingTax(2_000_000)).toBe(306_300);
    expect(withholdingTax(3_000_000)).toBe(510_500);
    expect(withholdingTax(105_000)).toBe(10_720); // 10720.5 floored
    expect(withholdingTax(0)).toBe(0);
  });
  it("applies flat deduction variant and net", () => {
    expect(withholdingTaxFlat(50_000, 10_000)).toBe(4_084);
    expect(applyWithholding(500_000)).toEqual({ base: 500_000, withholding: 51_050, net: 448_950 });
  });
});
