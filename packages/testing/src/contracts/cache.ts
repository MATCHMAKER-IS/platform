/**
 * Cache 実装の契約テスト。任意の Cache 実装がこの spec を満たすことを保証する。
 * 新しいアダプタを足しても、この契約に通れば既存と同じ振る舞いが担保される
 * (実装差による属人的なバグを防ぐ)。
 * @packageDocumentation
 */
import { describe, it, expect } from "vitest";
import type { Cache } from "@platform/cache";

/**
 * Cache の契約テストを実行する。
 * @param name テスト名(実装名)
 * @param makeCache テスト対象の Cache を生成する関数(毎回新規)
 *
 * @example
 * ```ts
 * import { createCache, createMemoryCache } from "@platform/cache";
 * runCacheContract("memory", () => createCache(createMemoryCache()));
 * ```
 */
export function runCacheContract(name: string, makeCache: () => Cache): void {
  describe(`Cache 契約: ${name}`, () => {
    it("set した値を get できる", async () => {
      const cache = makeCache();
      await cache.set("k", { v: 1 });
      const r = await cache.get<{ v: number }>("k");
      expect(r.ok && r.value).toEqual({ v: 1 });
    });

    it("未設定キーは null", async () => {
      const cache = makeCache();
      const r = await cache.get("none");
      expect(r.ok && r.value).toBeNull();
    });

    it("delete 後は取得できない", async () => {
      const cache = makeCache();
      await cache.set("k", 1);
      await cache.delete("k");
      const r = await cache.get("k");
      expect(r.ok && r.value).toBeNull();
    });

    it("getOrSet はミス時のみ loader を呼ぶ", async () => {
      const cache = makeCache();
      let calls = 0;
      const loader = async () => { calls += 1; return "v"; };
      await cache.getOrSet("k", 60, loader);
      await cache.getOrSet("k", 60, loader);
      expect(calls).toBe(1);
    });
  });
}
