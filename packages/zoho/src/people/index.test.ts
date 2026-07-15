import { describe, it, expect } from "vitest";
import { createZohoPeopleClient } from "./index.js";

describe("zoho people", () => {
  it("form-based paths", async () => {
    let url = "";
    const fetchImpl = (async (u: string) => { url = u; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const pe = createZohoPeopleClient({ dataCenter: "com", accessToken: "TK", fetchImpl });
    await pe.getEmployees({ limit: 100 });
    expect(url).toContain("https://people.zoho.com/people/api/forms/json/employee/records");
  });
});
