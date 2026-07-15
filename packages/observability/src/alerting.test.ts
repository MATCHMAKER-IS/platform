import { describe, it, expect } from "vitest";
import { createAlertManager, errorRateAbove, gaugeAtLeast } from "./alerting.js";
const view = (o: Partial<{ counters: Record<string, number>; gauges: Record<string, number> }> = {}) => ({ counters: o.counters ?? {}, gauges: o.gauges ?? {}, histograms: {} });
describe("alerting", () => {
  it("fires, stays firing, recovers", () => {
    const mgr = createAlertManager([{ name: "err", severity: "critical", condition: errorRateAbove("t", "e", 0.05), describe: () => "x" }]);
    expect(mgr.evaluate(view({ counters: { t: 100, e: 10 } }))).toHaveLength(1);
    expect(mgr.evaluate(view({ counters: { t: 200, e: 20 } }))).toHaveLength(0);
    const rec = mgr.evaluate(view({ counters: { t: 300, e: 3 } }));
    expect(rec[0]!.firing).toBe(false);
  });
  it("suppresses flapping with forEvaluations", () => {
    const mgr = createAlertManager([{ name: "f", severity: "warning", condition: gaugeAtLeast("g", 1), describe: () => "x", forEvaluations: 2 }]);
    expect(mgr.evaluate(view({ gauges: { g: 1 } }))).toHaveLength(0);
    expect(mgr.evaluate(view({ gauges: { g: 1 } }))).toHaveLength(1);
  });
});
