import { describe, it, expect } from "vitest";
import { createRateLimiter, createMemoryStore } from "./index.js";

describe("ratelimit (memory)", () => {
  it("上限まで許可し、超過で拒否する", async () => {
    const limiter = createRateLimiter({ store: createMemoryStore(), limit: 3, windowSeconds: 60 });
    const key = "user:1";
    for (let i = 0; i < 3; i++) {
      const r = await limiter.check(key);
      expect(r.ok && r.value.allowed).toBe(true);
    }
    const over = await limiter.check(key);
    expect(over.ok && over.value.allowed).toBe(false);
    if (over.ok) expect(over.value.remaining).toBe(0);
  });

  it("キーが違えば独立してカウントする", async () => {
    const limiter = createRateLimiter({ store: createMemoryStore(), limit: 1, windowSeconds: 60 });
    expect((await limiter.check("a")).ok).toBe(true);
    const b = await limiter.check("b");
    expect(b.ok && b.value.allowed).toBe(true);
  });
});
