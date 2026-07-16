import { describe, it, expect } from "vitest";
import { createZohoBooksClient } from "./index";

describe("zoho books", () => {
  it("organization_id on every request", async () => {
    let cap: { url: string; method?: string } | null = null;
    const fetchImpl = (async (url: string, init: { method?: string }) => { cap = { url, method: init.method }; return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}), text: async () => "" }; }) as unknown as typeof fetch;
    const books = createZohoBooksClient({ apiDomain: "https://www.zohoapis.com", accessToken: "TK", organizationId: "10234695", fetchImpl });
    await books.listInvoices({ status: "unpaid" });
    expect(cap!.url).toContain("organization_id=10234695");
    expect(cap!.url).toContain("status=unpaid");
    await books.getInvoice("982000000567114");
    expect(cap!.url).toContain("/books/v3/invoices/982000000567114");
    expect(cap!.url).toContain("organization_id=10234695");
  });
});
