import { describe, it, expect } from "vitest";
import { createTaggedCache, tag } from "./tagged";
import type { Cache } from "./index";

/** メモリ実装（テスト用）。 */
function makeCache(): Cache & { size: () => number } {
  const store = new Map<string, unknown>();
  return {
    async get<T>(key: string) { return { ok: true as const, value: (store.has(key) ? store.get(key) : null) as T | null }; },
    async set<T>(key: string, value: T) { store.set(key, value); return { ok: true as const, value: undefined }; },
    async delete(key: string) { store.delete(key); return { ok: true as const, value: undefined }; },
    async getOrSet<T>(key: string, _ttl: number, loader: () => Promise<T>) {
      if (store.has(key)) return { ok: true as const, value: store.get(key) as T };
      const v = await loader();
      store.set(key, v);
      return { ok: true as const, value: v };
    },
    async getOrSetSwr<T>() { return { ok: false as const, error: new Error("未使用") as never }; },
    size: () => store.size,
  };
}

describe("createTaggedCache(タグ付きキャッシュ)", () => {
  it("**キーを列挙せずにまとめて無効化できる**", async () => {
    const t = createTaggedCache(makeCache());
    let calls = 0;
    const load = async () => { calls += 1; return "見積"; };

    await t.getOrSet("quote:1001", ["customer:42"], 300, load);
    await t.getOrSet("quote:1001", ["customer:42"], 300, load);
    expect(calls).toBe(1); // 2 回目はキャッシュ

    await t.invalidate("customer:42");
    await t.getOrSet("quote:1001", ["customer:42"], 300, load);
    expect(calls).toBe(2); // 無効化されたので読み直す
  });

  it("**タグの並び順に依存しない**（呼び出し側で順序が揺れても同じ）", async () => {
    const t = createTaggedCache(makeCache());
    await t.set("q", ["b", "a"], "X");
    const r = await t.get<string>("q", ["a", "b"]);
    expect(r.ok ? r.value : null).toBe("X");
  });

  it("複数タグのうち**片方を消せば無効**になる", async () => {
    const t = createTaggedCache(makeCache());
    await t.set("q", ["customer:1", "product:9"], "Y");
    await t.invalidate("product:9");
    const r = await t.get<string>("q", ["customer:1", "product:9"]);
    expect(r.ok ? r.value : "取得に失敗").toBeNull();
  });

  it("**無関係なタグには影響しない**", async () => {
    const t = createTaggedCache(makeCache());
    await t.set("q1", ["customer:1"], "A");
    await t.set("q2", ["customer:2"], "B");
    await t.invalidate("customer:1");
    const r = await t.get<string>("q2", ["customer:2"]);
    expect(r.ok ? r.value : null).toBe("B");
  });

  it("複数のタグを一度に無効化できる", async () => {
    const t = createTaggedCache(makeCache());
    await t.set("q1", ["a"], "A");
    await t.set("q2", ["b"], "B");
    await t.invalidate("a", "b");
    const r1 = await t.get<string>("q1", ["a"]);
    const r2 = await t.get<string>("q2", ["b"]);
    expect(r1.ok ? r1.value : "取得に失敗").toBeNull();
    expect(r2.ok ? r2.value : "取得に失敗").toBeNull();
  });

  it("タグ無しでも使える（通常のキャッシュと同じ）", async () => {
    const t = createTaggedCache(makeCache());
    await t.set("plain", [], "V");
    const r = await t.get<string>("plain", []);
    expect(r.ok ? r.value : null).toBe("V");
  });

  it("世代は無効化のたびに 1 つ進む", async () => {
    const t = createTaggedCache(makeCache());
    const gen = async () => { const g = await t.generation("x"); return g.ok ? g.value : -1; };
    expect(await gen()).toBe(0);
    await t.invalidate("x");
    expect(await gen()).toBe(1);
    await t.invalidate("x");
    expect(await gen()).toBe(2);
  });

  it("**古い値はすぐには消えない**（TTL で自然に消える）", async () => {
    const cache = makeCache();
    const t = createTaggedCache(cache);
    await t.set("q", ["a"], "old");
    const before = cache.size();
    await t.invalidate("a");
    // 世代番号が 1 つ増えるだけで、古い値は残っている
    expect(cache.size()).toBeGreaterThanOrEqual(before);
  });
});

describe("tag(タグ名の組み立て)", () => {
  it("**大文字小文字を揃える**（揺れると無効化しても消えない）", () => {
    expect(tag("Customer", 42)).toBe("customer:42");
    expect(tag("CUSTOMER", 42)).toBe("customer:42");
  });

  it("前後の空白を落とす", () => {
    expect(tag(" product ", " A-1 ")).toBe("product:A-1");
  });

  it("数値でも文字列でも使える", () => {
    expect(tag("order", 1)).toBe("order:1");
    expect(tag("order", "1")).toBe("order:1");
  });
});
