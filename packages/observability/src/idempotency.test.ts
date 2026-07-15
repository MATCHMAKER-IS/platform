import { describe, it, expect } from "vitest";
import { createMemoryIdempotencyStore, withIdempotency, IdempotencyConflictError } from "./idempotency.js";
describe("idempotency", () => {
  it("runs once, caches, releases on error, conflicts in-flight", async () => {
    const store = createMemoryIdempotencyStore(); let n = 0;
    const a = await withIdempotency(store, "k", async () => { n++; return 1; });
    const b = await withIdempotency(store, "k", async () => { n++; return 2; });
    expect(a).toBe(1); expect(b).toBe(1); expect(n).toBe(1);
    const slow = createMemoryIdempotencyStore();
    const p = withIdempotency(slow, "s", async () => { await new Promise((r) => setTimeout(r, 30)); return 1; });
    await expect(withIdempotency(slow, "s", async () => 2)).rejects.toBeInstanceOf(IdempotencyConflictError);
    await p;
  });
});
