import { describe, it, expect } from "vitest";
import { createEkycClient, createTrustdockClient } from "./client";
describe("ekyc client", () => {
  function fakeFetch(calls: { url: string; method?: string; headers?: Record<string, string> }[]) {
    return (async (url: string | URL, init: { method?: string; headers?: Record<string, string> } = {}) => {
      calls.push({ url: String(url), ...(init.method ? { method: init.method } : {}), ...(init.headers ? { headers: init.headers } : {}) });
      return new Response(JSON.stringify({ id: "app_1", status: "in_review" }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
  }
  it("calls endpoints with auth + :id substitution", async () => {
    const calls: { url: string; method?: string; headers?: Record<string, string> }[] = [];
    const c = createEkycClient({ apiKey: "k", baseUrl: "https://ex.test/v2", fetchImpl: fakeFetch(calls) });
    const r = await c.createApplication({ document_type: "passport" });
    expect(r.ok).toBe(true);
    expect(calls[0]!.url).toContain("/v2/applications");
    expect(calls[0]!.headers!["X-Api-Key"]).toBe("k");
    await c.getApplication("app_1");
    expect(calls[1]!.url).toContain("/applications/app_1");
  });
  it("trustdock preset sets base url", async () => {
    const calls: { url: string }[] = [];
    const c = createTrustdockClient({ apiKey: "k", environment: "sandbox", fetchImpl: fakeFetch(calls as never) });
    await c.getApplication("x");
    expect(calls[0]!.url).toContain("sandbox.api.trustdock.io");
  });
});
