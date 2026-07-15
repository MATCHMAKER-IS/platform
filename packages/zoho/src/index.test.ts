import { describe, it, expect, vi, afterEach } from "vitest";
import { createZohoCrmClient } from "./index.js";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; vi.restoreAllMocks(); });

describe("zoho", () => {
  it("Zoho-oauthtoken スキームで crm/v8 を叩く", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ data: [] }) });
    globalThis.fetch = f as unknown as typeof fetch;
    const zoho = createZohoCrmClient({ apiDomain: "https://www.zohoapis.jp", accessToken: "tok" });
    const res = await zoho.getRecords("Leads", { perPage: 5 });
    expect(res.ok).toBe(true);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain("/crm/v8/Leads");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Zoho-oauthtoken tok" });
  });
});
