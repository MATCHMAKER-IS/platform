import { describe, it, expect, vi, afterEach } from "vitest";
import { createGoogleSheetsClient } from "./index.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

describe("google sheets", () => {
  it("getValues は values エンドポイントに Bearer で GET する", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ values: [["a"]] }) });
    globalThis.fetch = f as unknown as typeof fetch;
    const sheets = createGoogleSheetsClient({ accessToken: "tok" });
    const res = await sheets.getValues("SID", "Sheet1!A1:B2");
    expect(res.ok && res.value.values).toEqual([["a"]]);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain("/SID/values/");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });
});

import { createGoogleMapsClient } from "./index.js";

describe("google maps", () => {
  it("geocode は address と key を付けて呼ぶ", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ results: [] }) });
    globalThis.fetch = f as unknown as typeof fetch;
    const maps = createGoogleMapsClient({ apiKey: "K" });
    await maps.geocode("東京駅");
    const [url] = f.mock.calls[0]!;
    expect(String(url)).toContain("/geocode/json");
    expect(String(url)).toContain("key=K");
  });
});
