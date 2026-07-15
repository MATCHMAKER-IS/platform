import { describe, it, expect } from "vitest";
import {
  parseCookies, serializeCookie, clearCookie, createSession, createServerSession, type SessionStore,
} from "./index.js";

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

describe("createSession(封緘クッキー)", () => {
  const session = createSession<{ userId: string }>({ secret: "test-secret-value-1234567890", cookie: { secure: false } });

  it("write→read の往復", () => {
    const setCookie = session.write({ userId: "u1" });
    const value = setCookie.split(";")[0]!.split("=").slice(1).join("=");
    const data = session.read(`session=${value}`);
    expect(data?.userId).toBe("u1");
  });
  it("期限切れは null", () => {
    const s2 = createSession<{ x: number }>({ secret: "test-secret-value-1234567890", maxAgeSec: -1 });
    const setCookie = s2.write({ x: 1 });
    const value = setCookie.split(";")[0]!.split("=").slice(1).join("=");
    expect(s2.read(`session=${value}`)).toBeNull();
  });
  it("別の秘密鍵では読めない", () => {
    const setCookie = session.write({ userId: "u1" });
    const value = setCookie.split(";")[0]!.split("=").slice(1).join("=");
    const other = createSession<{ userId: string }>({ secret: "different-secret-abcdefghij" });
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
