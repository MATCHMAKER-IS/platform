import { describe, it, expect } from "vitest";
import { createZohoTokenManager, createAuthedFetch } from "./token-manager";

function tokenFetch(seq: { n: number }) {
  return (async () => { seq.n++; return { ok: true, status: 200, json: async () => ({ access_token: "tok-" + seq.n, expires_in: 3600 }) }; }) as unknown as typeof fetch;
}

describe("token manager", () => {
  it("refreshes then caches", async () => {
    const seq = { n: 0 };
    const tm = createZohoTokenManager({ dataCenter: "jp", clientId: "c", clientSecret: "s", refreshToken: "r", fetchImpl: tokenFetch(seq) });
    expect(await tm.getAccessToken()).toBe("tok-1");
    expect(await tm.getAccessToken()).toBe("tok-1");
    expect(seq.n).toBe(1);
    tm.invalidate();
    expect(await tm.getAccessToken()).toBe("tok-2");
  });
  it("authedFetch injects header + retries on 401", async () => {
    const seq = { n: 0 };
    const tm = createZohoTokenManager({ dataCenter: "jp", clientId: "c", clientSecret: "s", refreshToken: "r", fetchImpl: tokenFetch(seq) });
    let calls = 0; const seen: string[] = [];
    const base = (async (_u: string, init: { headers?: Record<string, string> }) => { calls++; seen.push(init.headers!.Authorization); return { status: calls === 1 ? 401 : 200, ok: calls !== 1 } as Response; }) as unknown as typeof fetch;
    const af = createAuthedFetch(tm, base);
    const res = await af("https://x.jp/a", {});
    expect(res.status).toBe(200); expect(calls).toBe(2);
    expect(seen[0]).toContain("Zoho-oauthtoken");
  });
});
