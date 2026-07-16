import { describe, it, expect } from "vitest";
import { refreshAccessToken } from "./oauth";
import { accountsUrl, apiDomain, detectDataCenter } from "./datacenter";

describe("zoho core", () => {
  it("datacenter", () => { expect(accountsUrl("jp")).toBe("https://accounts.zoho.jp"); expect(apiDomain("eu")).toBe("https://www.zohoapis.eu"); expect(detectDataCenter("https://www.zohoapis.com.au")).toBe("com.au"); expect(detectDataCenter("bogus")).toBe("com"); });
  it("refresh builds correct request", async () => {
    let cap: { url: string; init: { method?: string; body?: string; headers?: Record<string, string> } } | null = null;
    const fake = (async (url: string, init: unknown) => { cap = { url, init: init as never }; return { ok: true, status: 200, json: async () => ({ access_token: "1000.tok", api_domain: "https://www.zohoapis.jp", expires_in: 3600 }) }; }) as unknown as typeof fetch;
    const r = await refreshAccessToken({ dataCenter: "jp", clientId: "cid", clientSecret: "sec", refreshToken: "rt", fetchImpl: fake });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.accessToken).toBe("1000.tok");
    expect(cap!.url).toBe("https://accounts.zoho.jp/oauth/v2/token");
    expect(cap!.init.body).toContain("grant_type=refresh_token");
  });
});
