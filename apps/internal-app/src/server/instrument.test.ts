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
    const { withApiObservability } = await import("./instrument");
    const wrapped = withApiObservability("/api/x", async () => new Response("ok", { status: 200 }));
    const res = await wrapped(new Request("https://h/api/x", { method: "GET" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
  it("**例外は投げ返さず、traceId つきの 500 に変換する**", async () => {
    // 素で投げると Next 既定の 500 画面になり、**traceId が返らず調査できない**。
    // エラーエンベロープに変換して返すのが意図した設計(instrument.ts のコメント参照)。
    const { withApiObservability } = await import("./instrument");
    const wrapped = withApiObservability("/api/e", async () => { throw new Error("boom"); });
    const res = await wrapped(new Request("https://h/api/e", { method: "POST" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: { code?: string; traceId?: string } };
    expect(body.error?.traceId).toBeTruthy();   // 調査に使える
    expect(JSON.stringify(body)).not.toContain("boom");  // 内部メッセージは漏らさない
  });

  it("status を持つ例外はそのステータスを尊重する", async () => {
    const { withApiObservability } = await import("./instrument");
    const wrapped = withApiObservability("/api/e", async () => {
      throw Object.assign(new Error("forbidden"), { status: 403 });
    });
    expect((await wrapped(new Request("https://h/api/e"))).status).toBe(403);
  });
});
