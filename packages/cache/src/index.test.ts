import { describe, it, expect, vi } from "vitest";
import { createCache, createMemoryCache } from "./index.js";

describe("cache (memory)", () => {
  it("set→get で値が戻る", async () => {
    const cache = createCache(createMemoryCache());
    await cache.set("k", { n: 1 });
    const r = await cache.get<{ n: number }>("k");
    expect(r.ok && r.value).toEqual({ n: 1 });
  });

  it("未ヒットは null", async () => {
    const cache = createCache(createMemoryCache());
    const r = await cache.get("missing");
    expect(r.ok && r.value).toBeNull();
  });

  it("getOrSet はミス時のみ loader を呼ぶ", async () => {
    const cache = createCache(createMemoryCache());
    const loader = vi.fn().mockResolvedValue("v");
    await cache.getOrSet("k", 60, loader);
    await cache.getOrSet("k", 60, loader);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
