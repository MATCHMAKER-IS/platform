import { describe, it, expect } from "vitest";
import { createMetrics } from "./metrics.js";
describe("metrics", () => {
  it("counter/gauge/histogram + prometheus", () => {
    const m = createMetrics([10, 100]);
    m.incrementCounter("req", 1, { r: "/a" }); m.incrementCounter("req", 1, { r: "/a" });
    m.setGauge("q", 3); m.observeHistogram("d", 5); m.observeHistogram("d", 50);
    const s = m.snapshot();
    expect(s.counters["req|r=/a"]).toBe(2); expect(s.gauges["q"]).toBe(3); expect(s.histograms["d"]!.count).toBe(2);
    expect(m.toPrometheus()).toContain("d_bucket");
  });
});
