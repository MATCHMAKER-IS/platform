import { describe, it, expect } from "vitest";
import { createOtlpExporter } from "./otlp";
import type { Span } from "./trace";
const span = (id: string): Span => ({ traceId: id, spanId: "s" + id, name: "GET /x", startTime: 1000, endTime: 1050, durationMs: 50, attributes: {}, status: "ok" });
describe("otlp exporter", () => {
  it("batches and flushes at maxBatchSize", async () => {
    const posts: unknown[] = [];
    const exp = createOtlpExporter({ endpoint: "http://c/v1/traces", serviceName: "app", maxBatchSize: 2, fetchImpl: (async (_u: string, i: { body: string }) => { posts.push(JSON.parse(i.body)); return { ok: true, status: 200 } as Response; }) as unknown as typeof fetch, scheduler: () => 1, clearScheduler: () => {} });
    exp.export(span("1"));
    expect(exp.pending()).toBe(1);
    exp.export(span("2"));
    await new Promise((r) => setTimeout(r, 5));
    expect(posts).toHaveLength(1);
  });
});
