import { describe, it, expect, vi } from "vitest";
import {
  parseCookies, serializeCookie, clearCookie, createSession, createServerSession, type SessionStore,
} from "./index";

describe("cookie", () => {
  it("パース", () => {
    expect(parseCookies("a=1; b=hello%20world; c=")).toEqual({ a: "1", b: "hello world", c: "" });
    expect(parseCookies(null)).toEqual({});
  });
  it("シリアライズ(属性付き)", () => {
    const c = serializeCookie("sid", "v", { maxAge: 60, sameSite: "Strict" });
    expect(c).toContain("sid=v");
    expect(c).toContain("Max-Age=60");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Strict");
  });
  it("clear は失効させる", () => {
    expect(clearCookie("sid")).toContain("Max-Age=0");
  });
});

// salt は必須。**環境ごとに変える**ことで、保存先が漏れても他環境の鍵に流用されない
// (@platform/crypto の deriveKey が 8 文字以上を要求する)
describe("createSession(封緘クッキー)", () => {
  const session = createSession<{ userId: string }>({ secret: "test-secret-value-1234567890", salt: "test-salt-1234", cookie: { secure: false } });

  it("write→read の往復", () => {
    const setCookie = session.write({ userId: "u1" });
    const value = setCookie.split(";")[0]!.split("=").slice(1).join("=");
    const data = session.read(`session=${value}`);
    expect(data?.userId).toBe("u1");
  });
  it("期限切れは null", () => {
    // **時間を進めて期限切れを作る。**
    // 以前は `maxAgeSec: -1` で「即座に期限切れ」を再現していたが、
    // 負の値は**単位の間違い**(ミリ秒を渡した等)と区別できないため、
    // 実装が起動時に落とすようになった。テストだけが古い形で残っていた。
    vi.useFakeTimers();
    try {
      const s2 = createSession<{ x: number }>({ secret: "test-secret-value-1234567890", salt: "test-salt-1234", maxAgeSec: 1 });
      const setCookie = s2.write({ x: 1 });
      const value = setCookie.split(";")[0]!.split("=").slice(1).join("=");
      expect(s2.read(`session=${value}`)?.x).toBe(1);
      vi.advanceTimersByTime(2000);
      expect(s2.read(`session=${value}`)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it("負の秒数は起動時に落とす(単位の間違いを黙って無制限にしない)", () => {
    expect(() => createSession({ secret: "test-secret-value-1234567890", salt: "test-salt-1234", maxAgeSec: -1 }))
      .toThrow(/0 以上の秒数/);
  });
  it("別の秘密鍵では読めない", () => {
    const setCookie = session.write({ userId: "u1" });
    const value = setCookie.split(";")[0]!.split("=").slice(1).join("=");
    const other = createSession<{ userId: string }>({ secret: "different-secret-abcdefghij", salt: "test-salt-1234" });
    expect(other.read(`session=${value}`)).toBeNull();
  });
});

describe("createServerSession(ストア型)", () => {
  function memoryStore(): SessionStore {
    const m = new Map<string, string>();
    return {
      get: async (k) => m.get(k) ?? null,
      set: async (k, v) => { m.set(k, v); },
      delete: async (k) => { m.delete(k); },
    };
  }

  it("create→read→destroy", async () => {
    const session = createServerSession<{ userId: string }>({ store: memoryStore() });
    const { id, setCookie } = await session.create({ userId: "u9" });
    expect(setCookie).toContain("sid=");
    const data = await session.read(`sid=${id}`);
    expect(data?.userId).toBe("u9");
    const clear = await session.destroy(`sid=${id}`);
    expect(clear).toContain("Max-Age=0");
    expect(await session.read(`sid=${id}`)).toBeNull();
  });
});
