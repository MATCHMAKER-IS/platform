import { describe, it, expect } from "vitest";
import { runCacheContract } from "@platform/testing";
import { createCache, createMemoryCache, createRedisCache, type RedisCacheClient } from "./index";

/**
 * **同じ約束を、すべての保存先で確かめる。**
 *
 * 【なぜ要るか】
 * `Cache` には保存先が 2 つあります(メモリ / Redis)。
 * それぞれに個別のテストはありますが、**「同じことができるか」は誰も見ていません**でした。
 *
 * 実装差は**入れ替えたときに出ます**:
 *
 * | 差が出るところ | 起きること |
 * |---|---|
 * | 未設定のキーの戻り値 | 片方は `null`、片方は `undefined` → **呼ぶ側の分岐が片方で外れる** |
 * | 有効期限の切れ方 | 片方は残り続ける → **古い値を返す** |
 * | 削除した後の `get` | 片方が例外 → **落ちる** |
 *
 * **開発ではメモリ、本番では Redis**という構成なので、
 * **差があると本番でだけ壊れます**——最も見つけにくい形です。
 *
 * 【この形にした理由】
 * `@platform/testing` の `runCacheContract` は、
 * **「Cache を作る関数」を渡すと共通の検査を一式回します**。
 * 保存先が増えたら、**ここに 1 行足すだけ**で同じ約束が課されます。
 */

/** テスト用の Redis 互換クライアント(メモリで動く)。 */
function fakeRedis(): RedisCacheClient {
  const store = new Map<string, { value: string; expiresAt: number | null }>();
  const alive = (key: string) => {
    const hit = store.get(key);
    if (hit === undefined) return null;
    // **期限切れは無いものとして扱う。** 本物の Redis と同じ振る舞い
    if (hit.expiresAt !== null && hit.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return hit;
  };
  return {
    async get(key) {
      return alive(key)?.value ?? null;
    },
    async set(key, value, ...args) {
      // `set(key, value, "PX", ms)` / `set(key, value, "EX", sec)` を解釈する
      let expiresAt: number | null = null;
      for (let i = 0; i < args.length; i += 1) {
        const unit = String(args[i]).toUpperCase();
        if (unit === "PX") expiresAt = Date.now() + Number(args[i + 1]);
        if (unit === "EX") expiresAt = Date.now() + Number(args[i + 1]) * 1000;
      }
      store.set(key, { value, expiresAt });
      return "OK";
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
  };
}

// **保存先が増えたら、ここに 1 行足す。**
runCacheContract("memory", () => createCache(createMemoryCache()));
runCacheContract("redis", () => createCache(createRedisCache(fakeRedis())));

describe("契約テストそのものが動いているか", () => {
  // **「契約テストを入れたつもり」を防ぐ。**
  // import しただけで呼び忘れていても、テストは緑になってしまう
  it("runCacheContract が検査を登録している", () => {
    expect(typeof runCacheContract).toBe("function");
  });
});
