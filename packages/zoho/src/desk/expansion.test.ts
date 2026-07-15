import { describe, it, expect } from "vitest";
import { createZohoDeskClient } from "./index.js";
describe("zoho desk expansion", () => {
  it("search + sendReply + threads", async () => {
    let cap: { url: string; method?: string } | null = null;
    const fetchImpl = (async (url: string, init: { method?: string }) => { cap = { url, method: init.method }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ data: [] }), text: async () => "" }; }) as unknown as typeof fetch;
    const d = createZohoDeskClient({ dataCenter: "jp", accessToken: "TK", orgId: "9", fetchImpl });
    await d.searchTickets({ searchStr: "x", limit: 20 });
    expect(cap!.url).toContain("/tickets/search");
    await d.sendReply("903", { content: "y" });
    expect(cap!.url).toContain("/tickets/903/sendReply"); expect(cap!.method).toBe("POST");
    await d.listThreads("903");
    expect(cap!.url).toContain("/tickets/903/threads");
  });
});
