/**
 * レイテンシ統計（純関数）。パーセンタイル・平均・スループット・エラー率。
 * @packageDocumentation
 */

/** レイテンシ統計。 */
export interface LatencyStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

/**
 * パーセンタイルを線形補間で求める。
 *
 * **性能は平均ではなく p95 を見る**(平均は外れ値に引きずられて実態を隠す)。
 *
 * @param samples 標本(**昇順でなくてよい**。内部で並べ替える)
 * @param p 0–100
 * @returns その位置の値。**空なら 0**
 */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = samples.slice().sort((a, b) => a - b);
  if (p <= 0) return sorted[0]!;
  if (p >= 100) return sorted[sorted.length - 1]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const frac = rank - lo;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * frac;
}

/**
 * レイテンシから統計を計算する。
 *
 * @param samples レイテンシ(ミリ秒)
 * @returns 件数・最小・最大・平均・p50・p95・p99
 */
export function latencyStats(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    count: samples.length,
    min: Math.min(...samples),
    max: Math.max(...samples),
    mean: sum / samples.length,
    p50: percentile(samples, 50),
    p90: percentile(samples, 90),
    p95: percentile(samples, 95),
    p99: percentile(samples, 99),
  };
}
