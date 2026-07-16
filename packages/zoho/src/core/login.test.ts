import { describe, it, expect } from "vitest";
import { buildAuthorizationUrl, exchangeCodeForToken, getUserInfo } from "./login";

describe("zoho login", () => {
  it("authorization url", () => {
    const u = buildAuthorizationUrl({ dataCenter: "jp", clientId: "1000.A", redirectUri: "https://app/cb", scope: ["email"], state: "st" });
    expect(u).toContain("https://accounts.zoho.jp/oauth/v2/auth");
    expect(u).toContain("response_type=code"); expect(u).toContain("state=st");
  });
  it("exchange + userinfo", async () => {
    const fetchImpl = (async (url: string) => {
      if (url.includes("/token")) return { ok: true, status: 200, json: async () => ({ access_token: "AT", refresh_token: "RT", expires_in: 3600 }) };
      return { ok: true, status: 200, json: async () => ({ Email: "a@x.jp", Display_Name: "A" }) };
    }) as unknown as typeof fetch;
    const ex = await exchangeCodeForToken({ dataCenter: "jp", clientId: "c", clientSecret: "s", redirectUri: "https://app/cb", code: "CODE", fetchImpl });
    expect(ex.ok).toBe(true);
    const ui = await getUserInfo({ dataCenter: "jp", accessToken: "AT", fetchImpl });
    expect(ui.ok).toBe(true);
    if (ui.ok) expect(ui.value.email).toBe("a@x.jp");
  });
});
