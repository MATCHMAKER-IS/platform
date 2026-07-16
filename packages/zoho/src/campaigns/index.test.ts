import { describe, it, expect } from "vitest";
import { createZohoCampaignsClient } from "./index";

describe("zoho campaigns", () => {
  it("resfmt=JSON + listkey", async () => {
    let url = "";
    const fetchImpl = (async (u: string) => { url = u; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const c = createZohoCampaignsClient({ dataCenter: "com", accessToken: "TK", fetchImpl });
    await c.listSubscribe("LKEY", { "Contact Email": "a@x.jp" }, "api");
    expect(url).toContain("https://campaigns.zoho.com/api/v1.1/json/listsubscribe");
    expect(url).toContain("resfmt=JSON");
    expect(url).toContain("listkey=LKEY");
  });
});
