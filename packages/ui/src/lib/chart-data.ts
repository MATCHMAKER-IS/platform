/**
 * 数値配列を recharts 等で使いやすい形へ整形する純ヘルパー。
 * @packageDocumentation
 */
import { histogram, movingAverage, cumulativeSum, type HistogramOptions } from "@platform/utils";

/** スパークライン用 {i, value}[]。 */
export function sparklineData(values: readonly number[]): Array<{ i: number; value: number }> {
  return values.map((value, i) => ({ i, value }));
}

/** ヒストグラム用 {label, count, start, end}[]。 */
export function histogramData(values: readonly number[], options?: HistogramOptions): Array<{ label: string; count: number; start: number; end: number }> {
  return histogram(values, options).map((b) => ({
    label: `${round1(b.start)}–${round1(b.end)}`,
    count: b.count,
    start: b.start,
    end: b.end,
  }));
}

/** 元系列と移動平均を並べた {i, value, ma}[](ma は窓が満ちるまで null)。 */
export function movingAverageData(values: readonly number[], window: number): Array<{ i: number; value: number; ma: number | null }> {
  const ma = movingAverage(values, window);
  return values.map((value, i) => ({ i, value, ma: i >= window - 1 ? ma[i - (window - 1)] ?? null : null }));
}

/** 元系列と累積和を並べた {i, value, cumulative}[]。 */
export function cumulativeData(values: readonly number[]): Array<{ i: number; value: number; cumulative: number }> {
  const cs = cumulativeSum(values);
  return values.map((value, i) => ({ i, value, cumulative: cs[i] ?? 0 }));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
