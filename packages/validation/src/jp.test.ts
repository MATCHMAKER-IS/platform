import { describe, it, expect } from "vitest";
import { isValidPostalCode, formatPostalCode } from "./jp";

describe("postal code", () => {
  it("valid", () => { expect(isValidPostalCode("123-4567")).toBe(true); expect(isValidPostalCode("1234567")).toBe(true); expect(isValidPostalCode("１２３-４５６７")).toBe(true); expect(isValidPostalCode("12-4567")).toBe(false); });
  it("format", () => { expect(formatPostalCode("1234567")).toBe("123-4567"); expect(formatPostalCode("１２３４５６７")).toBe("123-4567"); expect(formatPostalCode("12")).toBeNull(); });
});
