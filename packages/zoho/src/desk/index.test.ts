import { describe, it, expect } from "vitest";
import { createZohoDeskClient } from "./index.js";

function cap() {
  const s: { c: { url: string; method?: string; headers?: Record<string, string> } | null } = { c: null };
  const fetchImpl = (async (url: string, init: { method?: string; headers?: Record<string, string> }) => { s.c = { url, method: init.method, headers: init.headers }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ data: [] }), text: async () => "" }; }) as unknown as typeof fetch;
  return { s, fetchImpl };
}

describe("zoho desk", () => {
  it("orgId header + base url", async () => {
    const { s, fetchImpl } = cap();
    const desk = createZohoDeskClient({ dataCenter: "jp", accessToken: "TK", orgId: "2389290", fetchImpl });
    await desk.listTickets({ limit: 50 });
    expect(s.c!.url).toContain("https://desk.zoho.jp/api/v1/tickets");
    expect(s.c!.headers!.orgId).toBe("2389290");
    expect(s.c!.headers!.Authorization).toBe("Zoho-oauthtoken TK");
    await desk.updateTicket("903", { status: "Closed" });
    expect(s.c!.method).toBe("PATCH");
  });
});
