import { describe, it, expect } from "vitest";
import { normalizeEkycStatus, isEkycFinal, isEkycApproved } from "./status";
describe("ekyc status", () => {
  it("normalizes vendor vocab", () => {
    expect(normalizeEkycStatus("Approved")).toBe("approved");
    expect(normalizeEkycStatus("NG")).toBe("rejected");
    expect(normalizeEkycStatus("reviewing")).toBe("in_review");
    expect(normalizeEkycStatus("weird")).toBe("unknown");
    expect(normalizeEkycStatus(null)).toBe("unknown");
  });
  it("supports custom mapping", () => {
    expect(normalizeEkycStatus("完了", { "完了": "approved" })).toBe("approved");
  });
  it("classifies final/approved", () => {
    expect(isEkycFinal("approved")).toBe(true);
    expect(isEkycFinal("in_review")).toBe(false);
    expect(isEkycApproved("approved")).toBe(true);
    expect(isEkycApproved("rejected")).toBe(false);
  });
});
