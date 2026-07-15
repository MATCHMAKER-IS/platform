import { describe, it, expect } from "vitest";
import { createFreeeTokenManager, createFreeeAuthedFetch } from "./token.js";
describe("freee token manager", () => {
  it("refreshes, caches, and dedupes", async () => {
    let clock = 0, count = 0;
    const tf = (async () => { count++; return { ok: true, status: 200, json: async () => ({ access_token: "at-" + count, refresh_token: "rt", expires_in: 21600 }) }; }) as unknown as typeof fetch;
    const saved: string[] = [];
    const m = createFreeeTokenManager({ clientId: "c", clientSecret: "s", refreshToken: "r", fetchImpl: tf, now: () => clock, onRefresh: (r) => { saved.push(r.accessToken); } });
    expect(await m.getAccessToken()).toBe("at-1");
    expect(await m.getAccessToken()).toBe("at-1"); // cached
    expect(count).toBe(1);
    expect(saved[0]).toBe("at-1");
    clock = 21600 * 1000;
    expect(await m.getAccessToken()).toBe("at-2");
  });
  it("retries once on 401", async () => {
    const tf = (async () => ({ ok: true, status: 200, json: async () => ({ access_token: "at", refresh_token: "rt", expires_in: 21600 }) })) as unknown as typeof fetch;
    let calls = 0;
    const apiFetch = (async () => { calls++; return calls === 1 ? { status: 401 } : { status: 200 }; }) as unknown as typeof fetch;
    const m = createFreeeTokenManager({ clientId: "c", clientSecret: "s", refreshToken: "r", fetchImpl: tf, now: () => Date.now() });
    const authed = createFreeeAuthedFetch(m, apiFetch);
    expect((await authed("https://api.freee.co.jp/x")).status).toBe(200);
    expect(calls).toBe(2);
  });
});
