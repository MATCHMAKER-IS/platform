import { describe, it, expect } from "vitest";
import { createRedisLockStore, type RedisLockClient } from "./lock-redis";
function fakeRedis(now: () => number): RedisLockClient & { store: Map<string, { val: string; exp: number }> } {
  const store = new Map<string, { val: string; exp: number }>();
  return {
    store,
    set: async (key, val, _px, ttl) => { const e = store.get(key); if (e && e.exp > now()) return null; store.set(key, { val, exp: now() + ttl }); return "OK"; },
    eval: async (_s, _n, key, token) => { const e = store.get(key); if (e && e.val === token) { store.delete(key); return 1; } return 0; },
  };
}
describe("redis lock", () => {
  it("mutual exclusion + safe release", async () => {
    let clk = 0; const r = fakeRedis(() => clk);
    const a = createRedisLockStore(r); const b = createRedisLockStore(r);
    expect(await a.acquire("j", 1000)).toBe(true);
    expect(await b.acquire("j", 1000)).toBe(false);
    await a.release("j");
    expect(await b.acquire("j", 1000)).toBe(true);
    await a.release("j"); // a doesn't hold it → no-op
    expect(r.store.has("lock:j")).toBe(true);
  });
});
