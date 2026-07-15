import { describe, it, expect } from "vitest";
import { poll } from "./poll.js";

describe("poll", () => {
  it("resolves when condition met", async () => { let n = 0; const v = await poll(async () => ++n, { intervalMs: 5, until: (x) => x >= 3 }); expect(v).toBe(3); });
  it("times out", async () => { await expect(poll(async () => 0, { intervalMs: 20, timeoutMs: 30, until: () => false })).rejects.toThrow(); });
});
