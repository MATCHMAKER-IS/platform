import { describe, it, expect, vi } from "vitest";
import { buildGoogleAuthUrl, createGoogleTokenManager, getGoogleUserInfo } from "./oauth";
describe("google oauth", () => {
  it("builds auth url", () => {
    const url = buildGoogleAuthUrl({ clientId: "cid", redirectUri: "https://app/cb", scopes: ["openid", "email"], state: "s", forceConsent: true });
    const p = new URL(url).searchParams;
    expect(p.get("client_id")).toBe("cid");
    expect(p.get("scope")).toBe("openid email");
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
  });
  it("token manager refreshes and caches", async () => {
    let n = 0; let clock = 0;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ access_token: `at${++n}`, expires_in: 3600 }), { status: 200 })) as unknown as typeof fetch;
    const m = createGoogleTokenManager({ clientId: "c", clientSecret: "s", refreshToken: "rt", fetchImpl, now: () => clock });
    expect(await m.getAccessToken()).toBe("at1");
    expect(await m.getAccessToken()).toBe("at1"); // cached
    clock += 3600 * 1000;
    expect(await m.getAccessToken()).toBe("at2");
  });
  it("gets user info", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ sub: "1", email: "a@x.com", hd: "x.com" }), { status: 200 })) as unknown as typeof fetch;
    const ui = await getGoogleUserInfo("at", fetchImpl);
    expect(ui.email).toBe("a@x.com"); expect(ui.hd).toBe("x.com");
  });
});

describe("state は必須(CSRF 対策)", () => {
  // **任意だと渡し忘れが事故になる。** state が無いと攻撃者が自分の認可コードを
  // 送り込め、**被害者のアカウントに攻撃者の Google アカウントが紐づく**
  it("必ず URL に載る", () => {
    const url = buildGoogleAuthUrl({
      clientId: "cid", redirectUri: "https://app/cb", scopes: ["openid"], state: "abc123",
    });
    expect(new URL(url).searchParams.get("state")).toBe("abc123");
  });
  // **`microsoft` と揃える**(あちらは最初から必須)
  it("空文字でも載る(呼び出し側が乱数を入れる前提)", () => {
    const url = buildGoogleAuthUrl({
      clientId: "cid", redirectUri: "https://app/cb", scopes: ["openid"], state: "",
    });
    expect(new URL(url).searchParams.has("state")).toBe(true);
  });
});
