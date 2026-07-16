import { describe, it, expect } from "vitest";
import { createRedisCache, type RedisLike } from "./adapters/redis";
describe("redis cache adapter", () => {
  it("get/set/delete with TTL via injected client", async () => {
    const store = new Map<string, string>(); const ttls = new Map<string, number>();
    const fake: RedisLike = {
      get: async (k) => store.get(k) ?? null,
      set: async (k, v, mode, ttl) => { store.set(k, v); if (mode === "EX" && ttl) ttls.set(k, ttl); return "OK"; },
      del: async (k) => { store.delete(k); return 1; },
    };
    const a = createRedisCache(fake);
    await a.set("k", "v"); expect(await a.get("k")).toBe("v");
    await a.set("t", "v", 300); expect(ttls.get("t")).toBe(300);
    await a.delete("k"); expect(await a.get("k")).toBeNull();
  });
});
