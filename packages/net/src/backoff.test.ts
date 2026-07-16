import { describe, it, expect } from "vitest";
import { backoffDelay, withTimeout, retry } from "./backoff";

describe("backoff/retry", () => {
  it("exponential + cap", () => { expect(backoffDelay(0, { baseMs: 100 })).toBe(100); expect(backoffDelay(3, { baseMs: 100 })).toBe(800); expect(backoffDelay(10, { baseMs: 100, maxMs: 1000 })).toBe(1000); });
  it("timeout resolves in time", async () => expect(await withTimeout(Promise.resolve(42), 100)).toBe(42));
  it("timeout rejects", async () => { await expect(withTimeout(new Promise((r) => setTimeout(r, 200)), 20)).rejects.toThrow(); });
  it("retry succeeds on 3rd", async () => { let n = 0; const v = await retry(async () => { n++; if (n < 3) throw new Error("x"); return "ok"; }, { retries: 5, baseMs: 1 }); expect(v).toBe("ok"); expect(n).toBe(3); });
});
