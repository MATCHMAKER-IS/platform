import { describe, it, expect } from "vitest";
import {
  clamp, inRange, lerp, normalize, mapRange,
  round, ceilTo, floorTo, roundToStep, roundHalfEven, truncateDecimals,
  formatNumber, formatPercent, formatCompact, formatManOku, formatBytes,
  parseNumber, parseNumberOr, safeDivide, percentChange, gcd, lcm, isEven, isOdd, sequence,
  sum, mean, min, max, median, mode, variance, stddev, percentile,
  movingAverage, cumulativeSum, histogram, quartiles, formatRange, outliers, outlierBounds, withoutOutliers,
  linearRegression, linearRegressionXY, predict, trend, correlation, covariance, regressionInterval, regressionBand,
  decompose, pluckNumbers, seriesFromRows, autocorrelation, acf, dominantLag,
} from "./numbers.js";

describe("range/interp", () => {
  it("clamp", () => { expect(clamp(15, 0, 10)).toBe(10); expect(clamp(-3, 0, 10)).toBe(0); });
  it("inRange", () => { expect(inRange(5, 1, 10)).toBe(true); expect(inRange(11, 1, 10)).toBe(false); });
  it("lerp/normalize/mapRange", () => { expect(lerp(0, 100, 0.25)).toBe(25); expect(normalize(75, 50, 100)).toBe(0.5); expect(mapRange(5, 0, 10, 0, 100)).toBe(50); });
});

describe("rounding", () => {
  it("round FP", () => { expect(round(1.005, 2)).toBe(1.01); expect(round(2.5)).toBe(3); expect(round(1.255, 2)).toBe(1.26); });
  it("ceil/floor/step/trunc", () => { expect(ceilTo(1.234, 2)).toBe(1.24); expect(floorTo(1.239, 2)).toBe(1.23); expect(roundToStep(23, 5)).toBe(25); expect(truncateDecimals(1.789, 2)).toBe(1.78); });
  it("halfEven", () => { expect(roundHalfEven(0.5)).toBe(0); expect(roundHalfEven(1.5)).toBe(2); expect(roundHalfEven(2.5)).toBe(2); });
});

describe("format", () => {
  it("number", () => { expect(formatNumber(1234567.89, { decimals: 2 })).toBe("1,234,567.89"); expect(formatNumber(-1234)).toBe("-1,234"); });
  it("percent", () => { expect(formatPercent(0.2534, 1)).toBe("25.3%"); expect(formatPercent(25.34, 1, { ratio: false })).toBe("25.3%"); });
  it("compact/manOku/bytes", () => { expect(formatCompact(3450000)).toBe("3.5M"); expect(formatManOku(123456789)).toBe("1.2億"); expect(formatBytes(1536)).toBe("1.5 KB"); });
});

describe("parse/calc", () => {
  it("parseNumber", () => { expect(parseNumber("¥1,234")).toBe(1234); expect(parseNumber("１，２３４")).toBe(1234); expect(parseNumber("12.5%")).toBe(12.5); expect(Number.isNaN(parseNumber("abc"))).toBe(true); });
  it("parseNumberOr", () => { expect(parseNumberOr("x", 99)).toBe(99); expect(parseNumberOr("5", 0)).toBe(5); });
  it("safeDivide/percentChange", () => { expect(safeDivide(10, 0, -1)).toBe(-1); expect(percentChange(200, 250)).toBe(25); expect(Number.isNaN(percentChange(0, 5))).toBe(true); });
  it("gcd/lcm/parity/sequence", () => { expect(gcd(12, 18)).toBe(6); expect(lcm(4, 6)).toBe(12); expect(isEven(4)).toBe(true); expect(isOdd(3)).toBe(true); expect(sequence(0, 10, 3)).toEqual([0, 3, 6, 9]); });
});

describe("stats", () => {
  const v = [2, 4, 4, 4, 5, 5, 7, 9];
  it("sum/mean/min/max", () => { expect(sum(v)).toBe(40); expect(mean(v)).toBe(5); expect(min(v)).toBe(2); expect(max(v)).toBe(9); });
  it("median/mode", () => { expect(median([1, 2, 3, 4])).toBe(2.5); expect(mode(v)).toEqual([4]); expect(mode([1, 1, 2, 2])).toEqual([1, 2]); });
  it("variance/stddev/percentile", () => { expect(variance(v)).toBe(4); expect(stddev(v)).toBe(2); expect(percentile([1, 2, 3, 4], 50)).toBe(2.5); });
  it("empty", () => { expect(Number.isNaN(mean([]))).toBe(true); expect(sum([])).toBe(0); expect(mode([])).toEqual([]); });
});

describe("series/distribution", () => {
  it("movingAverage", () => { expect(movingAverage([1, 2, 3, 4, 5], 3)).toEqual([2, 3, 4]); expect(movingAverage([1, 2], 3)).toEqual([]); });
  it("cumulativeSum", () => expect(cumulativeSum([1, 2, 3, 4])).toEqual([1, 3, 6, 10]));
  it("histogram", () => {
    const h = histogram([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], { bins: 5 });
    expect(h.length).toBe(5); expect(h.every((b) => b.count === 2)).toBe(true);
    expect(histogram([3, 3, 3])).toEqual([{ start: 3, end: 3, count: 3 }]);
  });
  it("quartiles", () => { const q = quartiles([1, 2, 3, 4, 5]); expect(q.q1).toBe(2); expect(q.median).toBe(3); expect(q.q3).toBe(4); expect(q.iqr).toBe(2); });
  it("formatRange", () => { expect(formatRange(1000, 2000)).toBe("1,000〜2,000"); expect(formatRange(1000, 2000, { prefix: "¥" })).toBe("¥1,000〜¥2,000"); });
});

describe("outliers", () => {
  it("detects via IQR", () => expect(outliers([1, 2, 3, 4, 5, 100])).toEqual([100]));
  it("bounds", () => { const b = outlierBounds([1, 2, 3, 4, 5, 100]); expect(Math.abs(b.upper - 8.5) < 1e-9).toBe(true); });
  it("without", () => expect(withoutOutliers([1, 2, 3, 4, 5, 100])).toEqual([1, 2, 3, 4, 5]));
  it("empty", () => expect(outliers([])).toEqual([]));
});

describe("regression/trend", () => {
  it("perfect line", () => { const f = linearRegression([1, 3, 5, 7, 9]); expect(f.slope).toBe(2); expect(f.intercept).toBe(1); expect(Math.abs(f.r2 - 1) < 1e-12).toBe(true); expect(predict(f, 5)).toBe(11); });
  it("xy", () => { const f = linearRegressionXY([0, 1, 2, 3], [1, 2, 3, 4]); expect(f.slope).toBe(1); expect(f.intercept).toBe(1); });
  it("constant r2=1", () => expect(linearRegression([5, 5, 5]).r2).toBe(1));
  it("trend", () => { expect(trend([1, 2, 3]).direction).toBe("up"); expect(trend([3, 2, 1]).direction).toBe("down"); expect(trend([3, 3, 3]).direction).toBe("flat"); });
});

describe("correlation", () => {
  it("perfect positive", () => expect(Math.abs(correlation([1, 2, 3, 4], [2, 4, 6, 8]) - 1) < 1e-12).toBe(true));
  it("perfect negative", () => expect(Math.abs(correlation([1, 2, 3, 4], [8, 6, 4, 2]) + 1) < 1e-12).toBe(true));
  it("covariance sample", () => expect(Math.abs(covariance([1, 2, 3], [1, 2, 3], { sample: true }) - 1) < 1e-12).toBe(true));
  it("constant -> NaN", () => expect(Number.isNaN(correlation([1, 1, 1], [1, 2, 3]))).toBe(true));
});

describe("regression band", () => {
  const xs = [0, 1, 2, 3, 4];
  it("perfect line -> zero width", () => { const r = regressionInterval(xs, [1, 3, 5, 7, 9], 2); expect(r.yhat).toBe(5); expect(r.se).toBe(0); expect(r.lower).toBe(5); expect(r.upper).toBe(5); });
  it("prediction wider than confidence", () => {
    const c = regressionInterval(xs, [1, 2, 2, 5, 4], 2, { kind: "confidence" });
    const p = regressionInterval(xs, [1, 2, 2, 5, 4], 2, { kind: "prediction" });
    expect(p.upper - p.lower).toBeGreaterThan(c.upper - c.lower);
    expect(c.lower).toBeLessThan(c.yhat); expect(c.yhat).toBeLessThan(c.upper);
  });
  it("band length", () => expect(regressionBand(xs, [1, 3, 5, 7, 9]).length).toBe(5));
});

describe("decompose/rows", () => {
  const pattern = [10, -5, -10, 5];
  const vals = Array.from({ length: 24 }, (_, i) => 100 + 2 * i + pattern[i % 4]);
  it("seasonal indices", () => { const d = decompose(vals, 4); expect(d.seasonalIndices.every((v, i) => Math.abs(v - pattern[i]) < 0.5)).toBe(true); });
  it("residual near zero mid", () => { const d = decompose(vals, 4); expect(d.residual.slice(6, 18).filter((r) => r != null).every((r) => Math.abs(r as number) < 0.5)).toBe(true); });
  it("insufficient data -> null trend", () => expect(decompose([1, 2, 3], 4).trend.every((t) => t === null)).toBe(true));
  const rows = [{ m: "1", s: "1,200" }, { m: "2", s: 1500 }, { m: "3", s: "¥1,800" }, { m: "4", s: "bad" }];
  it("pluckNumbers", () => expect(pluckNumbers(rows, "s")).toEqual([1200, 1500, 1800]));
  it("seriesFromRows", () => { const se = seriesFromRows(rows, "s", "m"); expect(se.length).toBe(3); expect(se[0]).toEqual({ x: 1, y: 1200 }); });
});

describe("autocorrelation", () => {
  const per = Array.from({ length: 24 }, (_, i) => [1, 2, 3, 4][i % 4]);
  it("lag0=1", () => expect(autocorrelation(per, 0)).toBe(1));
  it("period peak", () => expect(autocorrelation(per, 4)).toBeGreaterThan(autocorrelation(per, 1)));
  it("acf length", () => expect(acf(per, 6).length).toBe(7));
  it("dominantLag", () => expect(dominantLag(per, 8)).toBe(4));
  it("constant -> NaN", () => expect(Number.isNaN(autocorrelation([5, 5, 5], 1))).toBe(true));
});
