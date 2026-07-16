import { describe, it, expect } from "vitest";
import { createTimestampToken, verifyTimestampToken, sha256Hex } from "./timestamp";
describe("dencho timestamp", () => {
  it("signs and verifies", () => {
    const secret = "tsa";
    const tok = createTimestampToken(sha256Hex("data"), secret, new Date("2025-07-25T10:00:00Z"));
    expect(verifyTimestampToken(tok, secret)).toBe(true);
    expect(verifyTimestampToken(tok, secret, sha256Hex("other"))).toBe(false);
    expect(verifyTimestampToken(tok, "wrong")).toBe(false);
    expect(verifyTimestampToken({ ...tok, signature: tok.signature.slice(0, -2) + "00" }, secret)).toBe(false);
  });
});
