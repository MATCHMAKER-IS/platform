/**
 * 数値配列を recharts 等で使いやすい形へ整形する純ヘルパー。
 * @packageDocumentation
 */
import { histogram, movingAverage, cumulativeSum, type HistogramOptions } from "@platform/utils";

/**
 * スパークライン用 {i, value}[]。
 *
 *
 * @param values 数値の配列
 * @returns SVG のパス用の点(**軸もラベルも無い小さなグラフ**。表の行内に埋めて傾向を見せる)
 */
export function sparklineData(values: readonly number[]): Array<{ i: number; value: number }> {
  return values.map((value, i) => ({ i, value }));
}

/**
 * ヒストグラム用 {label, count, start, end}[]。
 *
 *
 * @param values 数値の配列
 * @param binCount ビンの数
 * @returns グラフに渡す形
 */
export function histogramData(values: readonly number[], options?: HistogramOptions): Array<{ label: string; count: number; start: number; end: number }> {
  return histogram(values, options).map((b) => ({
    label: `${round1(b.start)}–${round1(b.end)}`,
    count: b.count,
    start: b.start,
    end: b.end,
  }));
}

/**
 * 元系列と移動平均を並べた {i, value, ma}[](ma は窓が満ちるまで null)。
 *
 *
 * @param values 数値の配列
 * @param window 区間の幅
 * @returns 移動平均(**端は計算できないので短くなる**)
 */
export function movingAverageData(values: readonly number[], window: number): Array<{ i: number; value: number; ma: number | null }> {
  const ma = movingAverage(values, window);
  return values.map((value, i) => ({ i, value, ma: i >= window - 1 ? ma[i - (window - 1)] ?? null : null }));
}

/**
 * 元系列と累積和を並べた {i, value, cumulative}[]。
 *
 *
 * @param values 数値の配列
 * @returns 累積和(**『今日までの合計』の推移**を見せる)
 */
export function cumulativeData(values: readonly number[]): Array<{ i: number; value: number; cumulative: number }> {
  const cs = cumulativeSum(values);
  return values.map((value, i) => ({ i, value, cumulative: cs[i] ?? 0 }));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
