import { describe, it, expect } from "vitest";
import { createRedisCache, type RedisCacheClient } from "./adapters/redis.js";
describe("redis cache adapter", () => {
  it("get/set with EX, delete via injected client", async () => {
    const store = new Map<string, string>(); let lastArgs: (string | number)[] = [];
    const fake: RedisCacheClient = {
      get: async (k) => store.get(k) ?? null,
      set: async (k, v, ...args) => { store.set(k, v); lastArgs = args; return "OK"; },
      del: async (k) => { store.delete(k); return 1; },
    };
    const a = createRedisCache(fake);
    await a.set("k", "v");
    expect(await a.get("k")).toBe("v");
    expect(lastArgs).toEqual([]);
    await a.set("k2", "v2", 300);
    expect(lastArgs).toEqual(["EX", 300]);
    await a.delete("k");
    expect(await a.get("k")).toBeNull();
  });
});
