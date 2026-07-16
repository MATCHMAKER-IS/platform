import { describe, it, expect } from "vitest";
import { retentionDeadline, isWithinRetention, daysUntilRetentionEnd } from "./retention";
describe("dencho retention", () => {
  it("computes deadline and remaining", () => {
    const start = new Date("2025-06-01T00:00:00Z");
    expect(retentionDeadline(start, 7).toISOString().slice(0, 10)).toBe("2032-05-31");
    expect(isWithinRetention(start, 7, new Date("2030-01-01"))).toBe(true);
    expect(isWithinRetention(start, 7, new Date("2033-01-01"))).toBe(false);
    expect(daysUntilRetentionEnd(start, 7, new Date("2032-05-01"))).toBe(30);
  });
});
