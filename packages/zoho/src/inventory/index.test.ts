import { describe, it, expect } from "vitest";
import { createZohoInventoryClient } from "./index";

describe("zoho inventory", () => {
  it("organization_id on requests", async () => {
    let url = "";
    const fetchImpl = (async (u: string) => { url = u; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const inv = createZohoInventoryClient({ dataCenter: "com", accessToken: "TK", organizationId: "10234695", fetchImpl });
    await inv.listItems({ perPage: 25 });
    expect(url).toContain("https://www.zohoapis.com/inventory/v1/items");
    expect(url).toContain("organization_id=10234695");
  });
});
