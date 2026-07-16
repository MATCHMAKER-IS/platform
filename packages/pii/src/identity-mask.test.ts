import { describe, it, expect } from "vitest";
import { maskMyNumber, maskIdentityNumber } from "./identity-mask";
describe("identity masking", () => {
  it("masks my number fully by default (number-act safe)", () => {
    expect(maskMyNumber("123456789018")).toBe("************");
    expect(maskMyNumber("1234-5678-9018")).toBe("************");
    expect(maskMyNumber("123456789018", 4)).toBe("********9018");
    expect(maskMyNumber("123456789018", 8)).toBe("********9018"); // capped at 4
  });
  it("masks identity numbers keeping tail", () => {
    expect(maskIdentityNumber("AB12345678CD")).toBe("********78CD");
    expect(maskIdentityNumber("TK-1234567")).toBe("*****4567");
  });
});
