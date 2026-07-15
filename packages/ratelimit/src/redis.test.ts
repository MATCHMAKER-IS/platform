import { describe, it, expect } from "vitest";
import { createRedisStore, type RedisLike } from "./redis.js";
describe("redis rate-limit store", () => {
  it("INCR + first-time EXPIRE atomically via eval", async () => {
    const store = new Map<string, { count: number; exp: number | null }>();
    let clock = 0; let evalCalls = 0;
    const fake: RedisLike = {
      eval: async (_s, _n, key, ttl) => {
        evalCalls++;
        const k = key as string;
        const e = store.get(k);
        if (e && e.exp !== null && e.exp <= clock) store.delete(k);
        const cur = store.get(k) ?? { count: 0, exp: null };
        cur.count += 1;
        if (cur.count === 1) cur.exp = clock + Number(ttl) * 1000;
        store.set(k, cur);
        return cur.count;
      },
    };
    const rl = createRedisStore(fake);
    expect(await rl.increment("a", 60)).toBe(1);
    expect(await rl.increment("a", 60)).toBe(2);
    expect(store.get("a")!.exp).toBe(60000);
    expect(evalCalls).toBe(2); // 1呼び出し=1eval(アトミック)
    clock = 61000;
    expect(await rl.increment("a", 60)).toBe(1);
  });
});
