import { describe, it, expect } from "vitest";
import { createRedisSeenStore, type RedisSeenClient } from "./seen-redis";
describe("redis seen", () => {
  it("markSeen dedups, has peeks", async () => {
    let clk = 0; const m = new Map<string, { exp: number }>();
    const c: RedisSeenClient = {
      set: async (k, _v, _p, ttl) => { const e = m.get(k); if (e && e.exp > clk) return null; m.set(k, { exp: clk + ttl }); return "OK"; },
      exists: async (k) => { const e = m.get(k); return e && e.exp > clk ? 1 : 0; },
    };
    const s = createRedisSeenStore(c);
    expect(await s.markSeen("m", 1000)).toBe(false);
    expect(await s.markSeen("m", 1000)).toBe(true);
    expect(await s.has("m")).toBe(true);
  });
});
