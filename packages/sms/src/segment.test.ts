import { describe, it, expect } from "vitest";
import { smsEncoding, smsLength, smsSegments, smsInfo } from "./segment.js";

describe("sms segment", () => {
  it("encoding", () => { expect(smsEncoding("Hello")).toBe("GSM-7"); expect(smsEncoding("こんにちは")).toBe("UCS-2"); });
  it("length", () => { expect(smsLength("a^b")).toBe(4); expect(smsLength("あいう")).toBe(3); });
  it("segments GSM", () => { expect(smsSegments("a".repeat(160))).toBe(1); expect(smsSegments("a".repeat(161))).toBe(2); expect(smsSegments("a".repeat(307))).toBe(3); });
  it("segments UCS", () => { expect(smsSegments("あ".repeat(70))).toBe(1); expect(smsSegments("あ".repeat(71))).toBe(2); });
  it("info/empty", () => { expect(smsInfo("こんにちは")).toEqual({ encoding: "UCS-2", length: 5, segments: 1 }); expect(smsSegments("")).toBe(0); });
});
