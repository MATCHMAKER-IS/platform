import { describe, it, expect } from "vitest";
import { eanCheckDigit, isValidEan13, isValidEan8, isValidJan, detectBarcodeKind, janCountryPrefix, isJapaneseJan, isBarcodeDetectorSupported } from "./barcode.js";
describe("barcode JAN/EAN", () => {
  it("computes check digits and validates", () => {
    expect(eanCheckDigit("490177701868")).toBe(6);
    expect(eanCheckDigit("9638507")).toBe(4);
    expect(isValidEan13("4901777018686")).toBe(true);
    expect(isValidEan13("4901777018680")).toBe(false);
    expect(isValidEan8("96385074")).toBe(true);
    expect(isValidJan("4901777018686")).toBe(true);
  });
  it("detects kind and Japanese prefix", () => {
    expect(detectBarcodeKind("4901777018686")).toBe("ean13");
    expect(detectBarcodeKind("96385074")).toBe("ean8");
    expect(detectBarcodeKind("123")).toBe("unknown");
    expect(janCountryPrefix("4901777018686")).toBe("49");
    expect(isJapaneseJan("4901777018686")).toBe(true);
    expect(isJapaneseJan("3001234567892")).toBe(false);
  });
  it("reports BarcodeDetector unsupported in node", () => {
    expect(isBarcodeDetectorSupported()).toBe(false);
  });
});
