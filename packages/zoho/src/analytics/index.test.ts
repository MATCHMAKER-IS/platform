import { describe, it, expect } from "vitest";
import { createZohoAnalyticsClient } from "./index";
describe("zoho analytics", () => {
  it("ORGID header + CONFIG export", async () => {
    let url = ""; let headers: Record<string, string> = {};
    const fetchImpl = (async (u: string, init: { headers?: Record<string, string> }) => { url = u; headers = init.headers ?? {}; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const a = createZohoAnalyticsClient({ dataCenter: "com", accessToken: "TK", orgId: "555", fetchImpl });
    await a.listWorkspaces();
    expect(url).toBe("https://analyticsapi.zoho.com/restapi/v2/workspaces");
    expect(headers["ZANALYTICS-ORGID"]).toBe("555");
    await a.exportData("WS1", "VIEW1", "csv");
    expect(decodeURIComponent(url)).toContain("responseFormat");
  });
});
