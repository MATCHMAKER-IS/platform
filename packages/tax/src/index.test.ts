import { describe, it, expect } from "vitest";
import { taxAmount, grossFromNet, netFromGross, summarizeTax, isValidInvoiceNumber, isValidCorporateNumber } from "./index";
function genCorp(body12: string): string { let sum = 0; for (let i = 0; i < 12; i++) { sum += Number(body12[11 - i]) * (i % 2 === 0 ? 1 : 2); } return String(9 - (sum % 9)) + body12; }
describe("tax", () => {
  it("computes tax and gross/net", () => {
    expect(taxAmount(1000, 10)).toBe(100);
    expect(taxAmount(1000, 8)).toBe(80);
    expect(grossFromNet(1000, 10)).toBe(1100);
    expect(netFromGross(1100, 10)).toBe(1000); // no FP error
  });
  it("summarizes by rate (invoice requirement)", () => {
    const s = summarizeTax([{ net: 3000, rate: 10 }, { net: 500, rate: 8 }, { net: 300, rate: 0 }]);
    expect(s.byRate).toHaveLength(3);
    expect(s.tax).toBe(340);
    expect(s.gross).toBe(4140);
  });
  it("rounds per rate group, not per line", () => {
    expect(summarizeTax([{ net: 105, rate: 10 }, { net: 105, rate: 10 }]).byRate[0]!.tax).toBe(21);
  });
  it("validates invoice registration number", () => {
    const corp = genCorp("234567890123");
    expect(isValidCorporateNumber(corp)).toBe(true);
    expect(isValidInvoiceNumber("T" + corp)).toBe(true);
    expect(isValidInvoiceNumber("T123")).toBe(false);
  });
});
