import { describe, it, expect } from "vitest";
import { createZohoProjectsClient } from "./index.js";

describe("zoho projects", () => {
  it("portal-scoped paths", async () => {
    let url = "";
    const fetchImpl = (async (u: string) => { url = u; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const p = createZohoProjectsClient({ dataCenter: "com", accessToken: "TK", portalId: "portal1", fetchImpl });
    await p.listProjects();
    expect(url).toContain("https://projectsapi.zoho.com/restapi/portal/portal1/projects/");
  });
});
