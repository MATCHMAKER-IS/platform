import { describe, it, expect } from "vitest";
import { createMemorySeenStore } from "./dedup";
describe("seen store has()", () => {
  it("peeks without recording", () => {
    let clk = 0; const s = createMemorySeenStore(() => clk);
    expect(s.has("k")).toBe(false);
    expect(s.has("k")).toBe(false); // peek しても記録されない
    s.markSeen("k", 1000);
    expect(s.has("k")).toBe(true);
    clk = 1001;
    expect(s.has("k")).toBe(false); // TTL 経過
  });
});
