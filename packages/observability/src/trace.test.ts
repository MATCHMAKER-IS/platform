import { describe, it, expect } from "vitest";
import { createTracer, toTraceparent, parseTraceparent, newTraceId, newSpanId } from "./trace.js";
describe("trace", () => {
  it("traceparent round-trip", () => { const t = newTraceId(), s = newSpanId(); const p = parseTraceparent(toTraceparent(t, s)); expect(p?.traceId).toBe(t); expect(p?.spanId).toBe(s); });
  it("span duration + parent", () => { let clk = 0; const spans: unknown[] = []; const tr = createTracer((s) => spans.push(s), () => clk); const p = tr.startSpan("a"); const c = tr.startSpan("b", { parent: { traceId: p.traceId, spanId: p.spanId } }); expect(c.traceId).toBe(p.traceId); clk = 40; expect(c.end().durationMs).toBe(40); });
  it("withSpan error", async () => { const spans: { status: string }[] = []; const tr = createTracer((s) => spans.push(s)); await expect(tr.withSpan("x", async () => { throw new Error("e"); })).rejects.toThrow(); expect(spans[0]!.status).toBe("error"); });
});
