import { describe, it, expect, vi } from "vitest";
import { createWebStorage, createMemoryWebStorage, clearNamespace } from "./web-storage";

type Theme = "light" | "dark" | "system";
const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark" || v === "system";

describe("createWebStorage(読み書き)", () => {
  it("書いたものが読める", () => {
    const s = createWebStorage({ key: "k", fallback: 0, storage: createMemoryWebStorage() });
    expect(s.set(42).ok).toBe(true);
    expect(s.get()).toBe(42);
  });

  it("**未保存なら fallback**(例外を投げない)", () => {
    const s = createWebStorage({ key: "k", fallback: "既定", storage: createMemoryWebStorage() });
    expect(s.get()).toBe("既定");
  });

  it("鍵には接頭辞と版が付く(同じオリジンでの衝突を防ぐ)", () => {
    const s = createWebStorage({ key: "theme", fallback: "system", namespace: "app-a", version: 2 });
    expect(s.resolvedKey).toBe("app-a:v2:theme");
  });

  it("**版を上げると前の値は読まれない**(形を変えたときの逃げ道)", () => {
    const mem = createMemoryWebStorage();
    createWebStorage({ key: "k", fallback: 0, storage: mem, version: 1 }).set(1);
    const v2 = createWebStorage({ key: "k", fallback: 0, storage: mem, version: 2 });
    expect(v2.get()).toBe(0);
  });
});

describe("壊れた値・古い形の扱い", () => {
  it("**JSON が壊れていても落ちない**(手で書き換えられることがある)", () => {
    const mem = createMemoryWebStorage();
    mem.setItem("app:v1:k", "{壊れている");
    expect(createWebStorage({ key: "k", fallback: "既定", storage: mem }).get()).toBe("既定");
  });

  it("**形が違えば無かったことにする**(前の版のデータが端末に残る)", () => {
    const mem = createMemoryWebStorage();
    mem.setItem("app:v1:theme", JSON.stringify({ t: Date.now(), v: { old: "shape" } }));
    const s = createWebStorage<Theme>({ key: "theme", fallback: "system", validate: isTheme, storage: mem });
    expect(s.get()).toBe("system");
  });

  it("validate を通る値はそのまま読める", () => {
    const mem = createMemoryWebStorage();
    const s = createWebStorage<Theme>({ key: "theme", fallback: "system", validate: isTheme, storage: mem });
    s.set("dark");
    expect(s.get()).toBe("dark");
  });
});

describe("TTL(下書きの保持)", () => {
  it("期限内は読める / **超えたら fallback**", () => {
    const mem = createMemoryWebStorage();
    let t = 1_000;
    const s = createWebStorage({ key: "draft", fallback: "", storage: mem, ttlMs: 60_000, now: () => t });
    s.set("書きかけ");
    t = 30_000;
    expect(s.get()).toBe("書きかけ");
    t = 100_000;
    expect(s.get()).toBe("");
  });
});

describe("保存先が使えないとき", () => {
  it("**サーバ側では get が fallback を返す**(ReferenceError にしない)", () => {
    const s = createWebStorage({ key: "k", fallback: "既定" });
    expect(s.get()).toBe("既定");
  });

  it("**サーバ側の set は err**(黙って成功したことにしない)", () => {
    const r = createWebStorage({ key: "k", fallback: 0 }).set(1);
    expect(r.ok).toBe(false);
  });

  it("**容量超過は err で返る**(例外で画面を止めない)", () => {
    const full = {
      ...createMemoryWebStorage(),
      setItem: () => { throw new Error("QuotaExceededError"); },
    };
    const r = createWebStorage({ key: "k", fallback: 0, storage: full }).set(1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("容量超過");
  });
});

describe("clearNamespace", () => {
  it("**接頭辞が合うものだけ消す**(他アプリの分を巻き込まない)", () => {
    const mem = createMemoryWebStorage();
    mem.setItem("app-a:v1:x", "1");
    mem.setItem("app-a:v1:y", "2");
    mem.setItem("app-b:v1:z", "3");
    expect(clearNamespace("app-a", "local", mem)).toBe(2);
    expect(mem.getItem("app-b:v1:z")).toBe("3");
    expect(mem.getItem("app-a:v1:x")).toBeNull();
  });
});

describe("subscribe(他タブとの同期)", () => {
  it("**イベントが無い環境でも購読を返す**(呼ぶ側に分岐を書かせない)", () => {
    const s = createWebStorage({ key: "k", fallback: 0, storage: createMemoryWebStorage() });
    const off = s.subscribe(() => { /* noop */ });
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });

  it("自分の鍵の変更だけを拾う", () => {
    const handlers: ((e: unknown) => void)[] = [];
    const g = globalThis as unknown as Record<string, unknown>;
    g["addEventListener"] = (_t: string, h: (e: unknown) => void) => handlers.push(h);
    g["removeEventListener"] = () => { /* noop */ };
    try {
      const s = createWebStorage({ key: "k", fallback: 0, namespace: "ns", storage: createMemoryWebStorage() });
      const seen = vi.fn();
      s.subscribe(seen);
      handlers[0]?.({ key: "ns:v1:other", newValue: JSON.stringify({ t: 1, v: 9 }) });
      expect(seen).not.toHaveBeenCalled();
      handlers[0]?.({ key: "ns:v1:k", newValue: JSON.stringify({ t: 1, v: 9 }) });
      expect(seen).toHaveBeenCalledWith(9);
    } finally {
      delete g["addEventListener"];
      delete g["removeEventListener"];
    }
  });
});
