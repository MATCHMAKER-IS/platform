import { describe, it, expect } from "vitest";
import { isValidDriversLicenseNumber, isValidJapanPassportNumber, isValidResidenceCardNumber, validateIdentityDocument, normalizeDocumentNumber } from "./identity";
describe("identity document validation", () => {
  it("validates by format", () => {
    expect(isValidDriversLicenseNumber("123456789012")).toBe(true);
    expect(isValidDriversLicenseNumber("12345678901")).toBe(false);
    expect(isValidJapanPassportNumber("TK1234567")).toBe(true);
    expect(isValidJapanPassportNumber("M12345678")).toBe(true);
    expect(isValidResidenceCardNumber("AB12345678CD")).toBe(true);
    expect(isValidResidenceCardNumber("AB1234CD")).toBe(false);
  });
  it("normalizes fullwidth and separators", () => {
    expect(normalizeDocumentNumber("ＴＫ－１２３４５６７")).toBe("TK1234567");
    expect(isValidDriversLicenseNumber("１２３４５６７８９０１２")).toBe(true);
  });
  it("dispatches by type", () => {
    expect(validateIdentityDocument("passport", "TK1234567")).toBe(true);
    expect(validateIdentityDocument("residence_card", "AB12345678CD")).toBe(true);
  });
});
