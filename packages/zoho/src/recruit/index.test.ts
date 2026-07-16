import { describe, it, expect } from "vitest";
import { createZohoRecruitClient } from "./index";
describe("zoho recruit", () => {
  it("candidates + delete ids", async () => {
    let url = ""; let method = "";
    const fetchImpl = (async (u: string, init: { method?: string }) => { url = u; method = init.method ?? "GET"; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ data: [] }), text: async () => "" }; }) as unknown as typeof fetch;
    const r = createZohoRecruitClient({ dataCenter: "com", accessToken: "TK", fetchImpl });
    await r.getCandidates({ perPage: 200 });
    expect(url).toContain("https://recruit.zoho.com/recruit/v2/Candidates");
    await r.deleteRecords("Candidates", ["1", "2"]);
    expect(url).toContain("ids=1%2C2"); expect(method).toBe("DELETE");
  });
});
