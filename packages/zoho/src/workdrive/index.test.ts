import { describe, it, expect } from "vitest";
import { createZohoWorkDriveClient } from "./index";
describe("zoho workdrive", () => {
  it("json:api create folder", async () => {
    let body: { data?: { attributes?: Record<string, unknown> } } | undefined;
    const fetchImpl = (async (_u: string, init: { body?: string }) => { body = init.body ? JSON.parse(init.body) : undefined; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const w = createZohoWorkDriveClient({ dataCenter: "com", accessToken: "TK", fetchImpl });
    await w.createFolder("PARENT", "folder");
    expect(body!.data!.attributes!.resource_type).toBe("folder");
    expect(body!.data!.attributes!.parent_id).toBe("PARENT");
  });
});
