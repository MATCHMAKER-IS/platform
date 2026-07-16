import { describe, it, expect, vi } from "vitest";

vi.mock("./observability.js", () => {
  const metrics = { incrementCounter: () => {}, setGauge: () => {}, observeHistogram: () => {}, toPrometheus: () => "", snapshot: () => ({}) };
  const tracer = { startSpan: () => ({ setAttribute: () => {}, setStatus: () => {}, end: () => ({}), traceparent: () => "", traceId: "t", spanId: "s" }), withSpan: async (_n: string, f: (s: unknown) => unknown) => f({ setAttribute: () => {}, setStatus: () => {} }) };
  return { metrics, tracer };
});

describe("resilient zoho fetch", () => {
  it("opens circuit after repeated failures then blocks", async () => {
    const { createResilientZohoFetch, zohoBreakerState } = await import("./zoho-client");
    // token 取得と API を制御
    const orig = globalThis.fetch;
    globalThis.fetch = (async (url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (u.includes("/oauth/v2/token")) return { ok: true, status: 200, json: async () => ({ access_token: "AT", expires_in: 3600 }) } as Response;
      throw new Error("down");
    }) as typeof fetch;
    const f = createResilientZohoFetch({ dataCenter: "jp", clientId: "c", clientSecret: "s", refreshToken: "r" });
    let errs = 0;
    for (let i = 0; i < 5; i++) { try { await f("https://x.zoho.jp/a"); } catch { errs++; } }
    expect(errs).toBe(5);
    expect(zohoBreakerState()).toBe("open");
    globalThis.fetch = orig;
  });
});
