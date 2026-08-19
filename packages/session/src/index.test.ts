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

describe("SameSite=None には Secure が必須", () => {
  // **ブラウザの仕様。** 欠けていると黙って破棄され、エラーも警告も出ない
  // ——「ログインできないが原因が分からない」形になる(2026-08 に対処)
  it("Secure なしの None は組み立てで止める", () => {
    expect(() => serializeCookie("s", "v", { sameSite: "None", secure: false })).toThrow();
  });
  // **既定は Secure が true** なので、None だけ指定すれば通る
  it("既定の Secure なら通る", () => {
    expect(serializeCookie("s", "v", { sameSite: "None" })).toContain("Secure");
  });
  // **ログアウトも同じ経路を通る**(clearCookie は serializeCookie に委譲)
  it("clearCookie でも同じ検証が効く", () => {
    expect(() => clearCookie("s", { sameSite: "None", secure: false })).toThrow();
  });
  // **Lax / Strict は Secure なしでも通る**(ローカル開発の http で使う)
  it("Lax は Secure なしでも通る", () => {
    expect(serializeCookie("s", "v", { sameSite: "Lax", secure: false })).not.toContain("Secure");
  });
});

// **鍵を替えると全員が即ログアウトする。** それでは「漏れたので今すぐ替える」が
// できない(替えられない鍵は守りにならない)。入れ替え中だけ旧鍵でも読めるようにする
describe("秘密鍵の入れ替え(previousSecret)", () => {
  const salt = "rotation-salt-1234";
  const old = createSession<{ userId: string }>({ secret: "old-secret-value-32chars-minimum", salt });
  const cookieOf = (header: string) => header.split(";")[0]!;

  it("鍵を替えるだけだと、既存のクッキーは読めなくなる", () => {
    const issued = cookieOf(old.write({ userId: "u1" }));
    const fresh = createSession<{ userId: string }>({ secret: "new-secret-value-32chars-minimum", salt });
    expect(fresh.read(issued)).toBeNull();
  });

  it("previousSecret を渡せば、旧鍵のクッキーも読める", () => {
    const issued = cookieOf(old.write({ userId: "u1" }));
    const rotating = createSession<{ userId: string }>({
      secret: "new-secret-value-32chars-minimum",
      previousSecret: "old-secret-value-32chars-minimum",
      salt,
    });
    expect(rotating.read(issued)).toEqual({ userId: "u1" });
  });

  // **書くのは常に新しい鍵。** 使うたびに移るので、有効期間を過ぎれば旧鍵は不要になる
  it("書き出したクッキーは新しい鍵のものになる", () => {
    const rotating = createSession<{ userId: string }>({
      secret: "new-secret-value-32chars-minimum",
      previousSecret: "old-secret-value-32chars-minimum",
      salt,
    });
    const reissued = cookieOf(rotating.write({ userId: "u1" }));
    // 旧鍵しか知らない側では、もう読めない
    expect(old.read(reissued)).toBeNull();
    // 新しい鍵だけを知る側では読める
    const after = createSession<{ userId: string }>({ secret: "new-secret-value-32chars-minimum", salt });
    expect(after.read(reissued)).toEqual({ userId: "u1" });
  });

  it("改ざんされたクッキーは、旧鍵があっても通らない", () => {
    const rotating = createSession<{ userId: string }>({
      secret: "new-secret-value-32chars-minimum",
      previousSecret: "old-secret-value-32chars-minimum",
      salt,
    });
    expect(rotating.read("session=tampered-value")).toBeNull();
  });
});
