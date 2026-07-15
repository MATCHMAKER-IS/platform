import { describe, it, expect } from "vitest";
import { createZohoCreatorClient } from "./index.js";
describe("zoho creator", () => {
  it("report/form paths", async () => {
    let url = ""; let method = "";
    const fetchImpl = (async (u: string, init: { method?: string }) => { url = u; method = init.method ?? "GET"; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const cr = createZohoCreatorClient({ dataCenter: "com", accessToken: "TK", accountOwner: "jason", appLinkName: "app", fetchImpl });
    await cr.getRecords("Leads", { limit: 100 });
    expect(url).toContain("/creator/v2.1/data/jason/app/report/Leads");
    await cr.addRecords("LeadForm", { Name: "x" });
    expect(url).toContain("/data/jason/app/form/LeadForm"); expect(method).toBe("POST");
  });
});
