import { describe, it, expect } from "vitest";
import { copyFile, moveFile, deleteByPrefix, movePrefix, calcUsage, findOlderThan } from "./operations";
import type { Storage } from "./index";

/** メモリ実装（テスト用）。 */
function makeStorage(): Storage & { store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    async put(key, body) { store.set(key, body); return { ok: true as const, value: undefined }; },
    async get(key) {
      const v = store.get(key);
      return v === undefined
        ? { ok: false as const, error: new Error("無い") as never }
        : { ok: true as const, value: v };
    },
    async delete(key) { store.delete(key); return { ok: true as const, value: undefined }; },
    async exists(key) { return { ok: true as const, value: store.has(key) }; },
    async list(prefix) {
      return { ok: true as const, value: [...store.keys()].filter((k) => prefix === undefined || k.startsWith(prefix)) };
    },
  } as Storage & { store: Map<string, Uint8Array> };
}

describe("copyFile(コピー)", () => {
  it("コピーできる", async () => {
    const s = makeStorage();
    await s.put("a.txt", new Uint8Array([1]));
    const r = await copyFile(s, "a.txt", "b.txt");
    expect(r.ok).toBe(true);
    expect(s.store.has("b.txt")).toBe(true);
    expect(s.store.has("a.txt")).toBe(true); // 元は残る
  });

  it("**既定では上書きしない**（元に戻せなくなる事故を防ぐ）", async () => {
    const s = makeStorage();
    await s.put("a.txt", new Uint8Array([1]));
    await s.put("b.txt", new Uint8Array([2]));
    expect((await copyFile(s, "a.txt", "b.txt")).ok).toBe(false);
  });

  it("overwrite: true なら上書きする", async () => {
    const s = makeStorage();
    await s.put("a.txt", new Uint8Array([1]));
    await s.put("b.txt", new Uint8Array([2]));
    expect((await copyFile(s, "a.txt", "b.txt", { overwrite: true })).ok).toBe(true);
    expect(s.store.get("b.txt")?.[0]).toBe(1);
  });

  it("同じキーなら何もしない", async () => {
    const s = makeStorage();
    expect((await copyFile(s, "a.txt", "a.txt")).ok).toBe(true);
  });

  it("元が無ければ失敗する", async () => {
    expect((await copyFile(makeStorage(), "無い", "b.txt")).ok).toBe(false);
  });
});

describe("moveFile(移動)", () => {
  it("**保存してから元を消す**", async () => {
    const s = makeStorage();
    await s.put("draft/x.pdf", new Uint8Array([1]));
    const r = await moveFile(s, "draft/x.pdf", "approved/x.pdf");
    expect(r.ok).toBe(true);
    expect(s.store.has("approved/x.pdf")).toBe(true);
    expect(s.store.has("draft/x.pdf")).toBe(false);
  });

  it("**保存に失敗したら元を消さない**", async () => {
    const s = makeStorage();
    await s.put("a.txt", new Uint8Array([1]));
    await s.put("b.txt", new Uint8Array([2]));
    // 上書き拒否で失敗する
    const r = await moveFile(s, "a.txt", "b.txt");
    expect(r.ok).toBe(false);
    expect(s.store.has("a.txt")).toBe(true); // 元が残っている
  });
});

describe("deleteByPrefix(一括削除)", () => {
  it("**空の接頭辞を拒む**（全件削除になる）", async () => {
    expect((await deleteByPrefix(makeStorage(), "")).ok).toBe(false);
    expect((await deleteByPrefix(makeStorage(), "   ")).ok).toBe(false);
  });

  it("接頭辞に一致するものだけ消す", async () => {
    const s = makeStorage();
    for (const k of ["tmp/a", "tmp/b", "keep/c"]) await s.put(k, new Uint8Array(1));
    const r = await deleteByPrefix(s, "tmp/");
    expect(r.ok && r.value.succeeded).toBe(2);
    expect([...s.store.keys()]).toEqual(["keep/c"]);
  });

  it("**dryRun なら消さずに数えるだけ**", async () => {
    const s = makeStorage();
    for (const k of ["tmp/a", "tmp/b"]) await s.put(k, new Uint8Array(1));
    const r = await deleteByPrefix(s, "tmp/", { dryRun: true });
    expect(r.ok && r.value.succeeded).toBe(2);
    expect(s.store.size).toBe(2); // 消えていない
  });
});

describe("movePrefix(接頭辞ごと移動)", () => {
  it("フォルダ名の変更に相当する", async () => {
    const s = makeStorage();
    for (const k of ["inv/2025/a", "inv/2025/b"]) await s.put(k, new Uint8Array(1));
    const r = await movePrefix(s, "inv/2025/", "archive/2025/");
    expect(r.ok && r.value.succeeded).toBe(2);
    expect(s.store.has("archive/2025/a")).toBe(true);
    expect(s.store.has("inv/2025/a")).toBe(false);
  });

  it("**移動先が移動元の内側なら拒む**（同じファイルを繰り返し移す）", async () => {
    expect((await movePrefix(makeStorage(), "inv/", "inv/old/")).ok).toBe(false);
  });

  it("同じ接頭辞なら何もしない", async () => {
    const r = await movePrefix(makeStorage(), "a/", "a/");
    expect(r.ok && r.value.succeeded).toBe(0);
  });

  it("空の接頭辞を拒む", async () => {
    expect((await movePrefix(makeStorage(), "", "x/")).ok).toBe(false);
  });
});

describe("calcUsage(使用量)", () => {
  it("ファイル数と合計サイズを数える", async () => {
    const s = makeStorage();
    await s.put("a", new Uint8Array(100));
    await s.put("b", new Uint8Array(50));
    const r = await calcUsage(s);
    expect(r.ok && r.value.fileCount).toBe(2);
    expect(r.ok && r.value.totalBytes).toBe(150);
  });

  it("**多い順に並べる**（どこから手を付けるかが分かる）", async () => {
    const s = makeStorage();
    await s.put("users/1/a", new Uint8Array(100));
    await s.put("logs/x", new Uint8Array(10));
    const r = await calcUsage(s);
    expect(r.ok && r.value.byPrefix[0]?.prefix).toBe("users/");
  });

  it("階層の深さを指定できる", async () => {
    const s = makeStorage();
    await s.put("dept/sales/a", new Uint8Array(10));
    await s.put("dept/dev/b", new Uint8Array(20));
    const r = await calcUsage(s, "dept/", { groupDepth: 2 });
    expect(r.ok && r.value.byPrefix.map((p) => p.prefix).sort()).toEqual(["dept/dev/", "dept/sales/"]);
  });

  it("空でも落ちない", async () => {
    const r = await calcUsage(makeStorage());
    expect(r.ok && r.value.fileCount).toBe(0);
  });
});

describe("findOlderThan(古いファイル)", () => {
  it("**キーの日付で判断する**（更新日時を持たない実装もある）", () => {
    expect(findOlderThan(["logs/2024-12-01/a", "logs/2026-01-01/b"], "2025-01-01")).toEqual(["logs/2024-12-01/a"]);
  });

  it("区切りが無くても読む", () => {
    expect(findOlderThan(["backup/20241201.sql"], "2025-01-01")).toHaveLength(1);
  });

  it("日付を含まないキーは対象外", () => {
    expect(findOlderThan(["config.json"], "2025-01-01")).toHaveLength(0);
  });
});
