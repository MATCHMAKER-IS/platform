import { describe, it, expect } from "vitest";
import { createZohoCrmClient } from "./index.js";

function capturingFetch() {
  const state: { cap: { url: string; method?: string; body?: unknown; auth?: string } | null } = { cap: null };
  const fetchImpl = (async (url: string, init: { method?: string; body?: string; headers?: Record<string, string> }) => {
    state.cap = { url, method: init.method, body: init.body ? JSON.parse(init.body) : undefined, auth: init.headers?.Authorization };
    return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ data: [] }), text: async () => "" };
  }) as unknown as typeof fetch;
  return { state, fetchImpl };
}

describe("zoho crm", () => {
  it("getRecords + auth", async () => {
    const { state, fetchImpl } = capturingFetch();
    const crm = createZohoCrmClient({ apiDomain: "https://www.zohoapis.jp", accessToken: "TK", fetchImpl });
    await crm.getRecords("Leads", { fields: ["Last_Name"], perPage: 50 });
    expect(state.cap!.url).toContain("/crm/v8/Leads?fields=Last_Name&per_page=50");
    expect(state.cap!.auth).toBe("Zoho-oauthtoken TK");
  });
  it("coql + delete + upsert", async () => {
    const { state, fetchImpl } = capturingFetch();
    const crm = createZohoCrmClient({ apiDomain: "https://www.zohoapis.com", accessToken: "TK", fetchImpl });
    await crm.coql("SELECT Last_Name FROM Leads LIMIT 5");
    expect(state.cap!.url).toContain("/crm/v8/coql");
    await crm.deleteRecords("Leads", ["1", "2"]);
    expect(state.cap!.url).toContain("ids=1%2C2");
    await crm.upsertRecords("Leads", [{ Email: "a@x.jp" }], ["Email"]);
    expect(state.cap!.url).toContain("/upsert");
  });
});
