import { describe, it, expect } from "vitest";
import { createZohoSignClient } from "./index.js";
describe("zoho sign", () => {
  it("data=JSON page_context + auth", async () => {
    let url = ""; let auth = "";
    const fetchImpl = (async (u: string, init: { headers?: Record<string, string> }) => { url = u; auth = init.headers?.Authorization ?? ""; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const s = createZohoSignClient({ dataCenter: "jp", accessToken: "TK", fetchImpl });
    await s.listDocuments({ row_count: 10 });
    expect(url).toContain("https://sign.zoho.jp/api/v1/requests?data=");
    expect(decodeURIComponent(url)).toContain("page_context");
    expect(auth).toBe("Zoho-oauthtoken TK");
  });
});
