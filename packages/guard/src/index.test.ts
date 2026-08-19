import { describe, it, expect } from "vitest";
import { requireSession, requireRole, enforceRateLimit, matchesSharedToken, clientIp } from "./index";
import type { Session } from "@platform/session";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit";

// **`Session<T>` の形に合わせる。** `read` は cookie ヘッダを受け、
// `refresh` も必須——欠けていると代入できない
// (2026-08、型検査が回っていなかったため食い違ったまま通っていた)。
const fakeSession = <T,>(value: T | null): Session<T> => ({
  read: () => value,
  write: () => "",
  destroy: () => "",
  refresh: () => null,
  inspect: () => null,
});

describe("guard", () => {
  it("requireSession: 無ければ UNAUTHORIZED", () => {
    expect(() => requireSession("", fakeSession<{ id: string }>(null))).toThrow();
    expect(requireSession("", fakeSession({ id: "u1" })).id).toBe("u1");
  });
  it("requireRole: ロール不足は FORBIDDEN", () => {
    expect(() => requireRole({ id: "u1", roles: ["user"] }, "admin")).toThrow();
    expect(() => requireRole({ id: "u1", roles: ["admin"] }, "admin")).not.toThrow();
  });
  it("enforceRateLimit: 上限超過で RATE_LIMITED", async () => {
    const limiter = createRateLimiter({ store: createMemoryStore(), limit: 2, windowSeconds: 60 });
    await enforceRateLimit(limiter, "k");
    await enforceRateLimit(limiter, "k");
    await expect(enforceRateLimit(limiter, "k")).rejects.toThrow();
  });
});

// **共有トークンの照合。** 認証が無い口を守る最後の砦なので、
// ここが緩むと「鍵を知らなくても通る」状態になる
describe("matchesSharedToken", () => {
  it("一致すれば true", () => {
    expect(matchesSharedToken("abc123", "abc123")).toBe(true);
  });

  it("違えば false", () => {
    expect(matchesSharedToken("abc123", "abc124")).toBe(false);
  });

  // **長さが違うと timingSafeEqual は例外を投げる。** 先に長さを見ている
  it("長さが違っても例外にならない", () => {
    expect(() => matchesSharedToken("short", "muchlongertoken")).not.toThrow();
    expect(matchesSharedToken("short", "muchlongertoken")).toBe(false);
  });

  // **「鍵を決めていない口が素通し」が最も危ない**
  it("期待値が未設定なら、何を渡しても false", () => {
    expect(matchesSharedToken("anything", "")).toBe(false);
    expect(matchesSharedToken("anything", undefined)).toBe(false);
    expect(matchesSharedToken("anything", null)).toBe(false);
  });

  it("受け取った値が無ければ false", () => {
    expect(matchesSharedToken(null, "secret")).toBe(false);
    expect(matchesSharedToken(undefined, "secret")).toBe(false);
    expect(matchesSharedToken("", "secret")).toBe(false);
  });

  // **空同士を「一致」にしない。** 未設定同士で通ると、設定漏れが素通しになる
  it("空同士でも false", () => {
    expect(matchesSharedToken("", "")).toBe(false);
  });

  // 日本語やマルチバイトでも落ちない(Buffer の長さで比べている)
  it("マルチバイトでも判定できる", () => {
    expect(matchesSharedToken("鍵です", "鍵です")).toBe(true);
    expect(matchesSharedToken("鍵です", "鍵でした")).toBe(false);
  });
});

// **呼び出し元の見分けは速度制限の土台。** ここがずれると、
// 全員を同じ人として数えたり、逆に同じ人を別人として通したりする
describe("clientIp", () => {
  const h = (headers: Record<string, string>) => ({
    headers: { get: (n: string) => headers[n.toLowerCase()] ?? null },
  });

  it("x-forwarded-for の先頭を使う（後ろは経由した中継）", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.5");
  });

  it("前後の空白を落とす", () => {
    expect(clientIp(h({ "x-forwarded-for": "  203.0.113.5  " }))).toBe("203.0.113.5");
  });

  // **nginx など、x-forwarded-for を付けない前段がある**
  it("x-forwarded-for が無ければ x-real-ip を見る", () => {
    expect(clientIp(h({ "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  // **空文字で通さない。** `""` を鍵にすると、名乗らない相手が全員 1 人になる
  it("空の x-forwarded-for は x-real-ip に落ちる", () => {
    expect(clientIp(h({ "x-forwarded-for": "", "x-real-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("どちらも無ければ unknown", () => {
    expect(clientIp(h({}))).toBe("unknown");
  });
});
