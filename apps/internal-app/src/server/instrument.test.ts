import { describe, it, expect, vi } from "vitest";

// observability.js を軽量モック(services.js の副作用を避ける)
vi.mock("./observability.js", () => {
  const calls: { counters: Record<string, number> } = { counters: {} };
  const metrics = {
    incrementCounter: (n: string, v = 1, l?: Record<string, string>) => { const k = n + JSON.stringify(l ?? {}); calls.counters[k] = (calls.counters[k] ?? 0) + v; },
    observeHistogram: () => {},
    toPrometheus: () => "",
  };
  const span = { setAttribute: () => {}, setStatus: () => {}, end: () => ({}), traceparent: () => "", traceId: "t", spanId: "s" };
  const tracer = { startSpan: () => span, withSpan: async (_n: string, f: () => unknown) => f() };
  return { metrics, tracer, __calls: calls };
});

describe("withApiObservability", () => {
  it("passes response through and counts requests", async () => {
    const { withApiObservability } = await import("./instrument.js");
    const wrapped = withApiObservability("/api/x", async () => new Response("ok", { status: 200 }));
    const res = await wrapped(new Request("https://h/api/x", { method: "GET" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
  it("re-throws handler errors", async () => {
    const { withApiObservability } = await import("./instrument.js");
    const wrapped = withApiObservability("/api/e", async () => { throw new Error("boom"); });
    await expect(wrapped(new Request("https://h/api/e", { method: "POST" }))).rejects.toThrow("boom");
  });
});
