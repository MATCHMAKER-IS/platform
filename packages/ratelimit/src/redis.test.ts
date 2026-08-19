import { describe, it, expect } from "vitest";
import { createRedisStore, type RedisLike } from "./redis";
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

describe("Lua スクリプト: TTL 無しのキーからも回復する", () => {
  /** eval に渡されたスクリプトを捕まえる。 */
  async function capture(): Promise<string> {
    let script = "";
    const store = createRedisStore({
      eval: async (s: string) => { script = s; return 1; },
    } as never);
    await store.increment("k", 60);
    return script;
  }

  // **`current == 1` だけだと、TTL 無しのキーから抜け出せない。**
  // 別経路で SET された・過去の不具合で残った、という形で生まれ、
  // カウントは増え続けるので `== 1` は二度と真にならず、
  // **その利用者が永久に制限される**
  it("TTL が -1 のときも EXPIRE を設定する", async () => {
    const script = await capture();
    expect(script).toContain("TTL");
    expect(script).toContain("-1");
  });

  // **1 回目は従来どおり**(TTL を引く往復を増やさない)
  it("1 回目は TTL を見ずに EXPIRE する", async () => {
    expect(await capture()).toContain("current == 1");
  });
});
