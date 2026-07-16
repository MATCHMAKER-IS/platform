import { describe, it, expect } from "vitest";
import { createCache, type CacheAdapter } from "./index";

function memAdapter(): CacheAdapter {
  const m = new Map<string, string>();
  return { async get(k) { return m.get(k) ?? null; }, async set(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } };
}

describe("cache stampede & swr", () => {
  it("single-flight: concurrent misses call loader once", async () => {
    const cache = createCache(memAdapter());
    let loads = 0;
    const loader = async () => { loads++; await new Promise((r) => setTimeout(r, 10)); return 42; };
    const results = await Promise.all(Array.from({ length: 8 }, () => cache.getOrSet("k", 60, loader)));
    expect(loads).toBe(1);
    expect(results.every((r) => r.ok && r.value === 42)).toBe(true);
  });
  it("swr: fresh returns cached, stale revalidates in background", async () => {
    let clk = 0; const cache = createCache(memAdapter(), () => clk);
    let loads = 0; const loader = async () => { loads++; return loads; };
    clk = 1000;
    expect((await cache.getOrSetSwr("s", { freshSeconds: 10, staleSeconds: 60 }, loader) as { value: number }).value).toBe(1);
    clk = 1000 + 5000;
    expect((await cache.getOrSetSwr("s", { freshSeconds: 10, staleSeconds: 60 }, loader) as { value: number }).value).toBe(1);
    expect(loads).toBe(1);
    clk = 1000 + 20000;
    await cache.getOrSetSwr("s", { freshSeconds: 10, staleSeconds: 60 }, loader);
    await new Promise((r) => setTimeout(r, 10));
    expect(loads).toBe(2);
  });
});
