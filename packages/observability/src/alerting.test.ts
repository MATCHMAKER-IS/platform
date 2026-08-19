import { describe, it, expect } from "vitest";
import { createAlertManager, errorRateAbove, gaugeAtLeast, counterBelow } from "./alerting";
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

describe("トラフィック断を検知する", () => {
  const view = (n: number) => ({ counters: { "http.requests": n }, gauges: {}, histograms: {} }) as never;

  // **エラー率のアラートだけでは「動いていない」を検知できない。**
  // `errorRateAbove` は 0 除算を避けるため**リクエストが 0 なら false**——
  // ロードバランサが全台を切り離しても鳴らない(2026-08 に `counterBelow` を追加)
  it("エラー率はリクエスト 0 で鳴らない", () => {
    const er = errorRateAbove("http.requests", "http.errors", 0.1);
    expect(er({ counters: { "http.requests": 0, "http.errors": 0 }, gauges: {}, histograms: {} } as never)).toBe(false);
  });
  it("counterBelow なら 0 で発報する", () => {
    expect(counterBelow("http.requests", 10)(view(0))).toBe(true);
  });
  // **計測自体が壊れた場合も拾う**(キーが無い)
  it("キーが無ければ発報する", () => {
    expect(counterBelow("http.requests", 10)({ counters: {}, gauges: {}, histograms: {} } as never)).toBe(true);
  });
  // **平常時は鳴らない**(境界)
  it("閾値以上なら鳴らない", () => {
    expect(counterBelow("http.requests", 10)(view(10))).toBe(false);
    expect(counterBelow("http.requests", 10)(view(9))).toBe(true);
  });
});
