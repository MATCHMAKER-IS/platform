import { describe, it, expect } from "vitest";
import { generateBackupCodes, verifyBackupCode, remainingBackupCodes, normalizeBackupCode } from "./recovery-codes.js";
const secret = "pepper";
describe("backup / recovery codes", () => {
  it("generates readable codes without plaintext storage", () => {
    const { codes, records } = generateBackupCodes(secret);
    expect(codes).toHaveLength(10);
    expect(codes[0]).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(codes.some((c) => /[01lo]/.test(c))).toBe(false);
    expect(JSON.stringify(records)).not.toContain(codes[0]!.replace("-", ""));
    expect(new Set(codes).size).toBe(10);
  });
  it("verifies single-use codes with normalization", () => {
    const { codes, records } = generateBackupCodes(secret);
    const v = verifyBackupCode(codes[2]!.replace("-", "").toUpperCase(), records, secret);
    expect(v.valid).toBe(true);
    expect(v.matchedIndex).toBe(2);
    expect(remainingBackupCodes(v.records)).toBe(9);
    expect(verifyBackupCode(codes[2]!, v.records, secret).valid).toBe(false); // 再利用不可
    expect(verifyBackupCode(codes[5]!, v.records, secret).valid).toBe(true);  // 他は有効
    expect(verifyBackupCode("zzzz-zzzz", records, secret).valid).toBe(false);
  });
  it("normalizes separators and case", () => {
    expect(normalizeBackupCode("AB CD-EF")).toBe("abcdef");
  });
});
