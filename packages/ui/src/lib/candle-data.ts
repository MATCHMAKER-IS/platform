/**
 * ローソク足(OHLC)の純ロジック。**描画を含まない**ので、サーバでも画面でも使える。
 *
 * 社内業務では株価だけでなく、**日次の在庫推移・受注金額のばらつき・センサー値の変動**など
 * 「1 期間の始値/高値/安値/終値」を見たい場面で使う。
 * @packageDocumentation
 */
import { movingAverage } from "@platform/utils";
import type { Candle } from "../components/charts/chart-math";

/** ローソク足 1 本(ラベル付き)。 */
export interface CandleRow extends Candle {
  label: string;
}

/**
 * 陽線か(終値 >= 始値)。
 *
 * @remarks
 * **同値(始値 = 終値)は陽線として扱う。** 描画側の `candleGeometry` が
 * `close >= open` で判定しているので、それに合わせている。ここがずれると
 * 「色は赤なのに集計上は陽線」という食い違いが起きる。
 *
 * @param c ローソク足
 * @returns 陽線なら true
 */
export function isBullish(c: Candle): boolean {
  return c.close >= c.open;
}

/**
 * 実体の値幅(始値と終値の差の絶対値)。
 *
 * @param c ローソク足
 * @returns 値幅(常に 0 以上)
 */
export function bodyRange(c: Candle): number {
  return Math.abs(c.close - c.open);
}

/**
 * 高値と安値の差(その期間にどれだけ振れたか)。
 *
 * @param c ローソク足
 * @returns 値幅(常に 0 以上)
 */
export function fullRange(c: Candle): number {
  return c.high - c.low;
}

/**
 * 移動平均を、**元の行と同じ長さ**で返す(先頭は null)。
 *
 * @remarks
 * `@platform/utils` の {@link movingAverage} は長さが `n - window + 1` になる。
 * そのままチャートへ渡すと **日付が window-1 本ぶんずれる**ので、
 * ここで先頭を null で埋めて揃える。**これを各アプリで書くと必ずずらす。**
 *
 * @param rows ローソク足の配列(時系列)
 * @param window 区間の幅(例: 5 なら 5 日移動平均)
 * @returns 各行に `ma` を足した配列。**計算できない先頭は `ma: null`**
 * @example
 * ```ts
 * withMovingAverage(rows, 5)[0].ma  // null(4 本目までは出せない)
 * withMovingAverage(rows, 5)[4].ma  // 1〜5 本目の終値の平均
 * ```
 */
export function withMovingAverage<T extends Candle>(rows: readonly T[], window: number): (T & { ma: number | null })[] {
  const ma = movingAverage(rows.map((r) => r.close), window);
  const offset = rows.length - ma.length; // 端で計算できない本数
  return rows.map((r, i) => ({ ...r, ma: i < offset ? null : (ma[i - offset] ?? null) }));
}

/** {@link summarizeCandles} の戻り値。 */
export interface CandleSummary {
  count: number;
  /** 陽線の本数。 */
  bullish: number;
  /** 陰線の本数(同値は陽線に数えるので `count - bullish`)。 */
  bearish: number;
  /** 期間の最高値。 */
  high: number;
  /** 期間の最安値。 */
  low: number;
  /** 最初の始値。 */
  first: number;
  /** 最後の終値。 */
  last: number;
  /** first → last の変化率(%)。first が 0 なら 0。 */
  changePercent: number;
  /** 1 本あたりの平均値幅(high - low)。 */
  averageRange: number;
}

/**
 * ローソク足の集計。
 *
 * @param rows ローソク足の配列(時系列)
 * @returns 陽線/陰線の本数・期間の高安・変化率など。**空配列なら全て 0**
 */
export function summarizeCandles(rows: readonly Candle[]): CandleSummary {
  if (rows.length === 0) {
    return { count: 0, bullish: 0, bearish: 0, high: 0, low: 0, first: 0, last: 0, changePercent: 0, averageRange: 0 };
  }
  const bullish = rows.filter(isBullish).length;
  const first = rows[0]!.open;
  const last = rows[rows.length - 1]!.close;
  const totalRange = rows.reduce((n, c) => n + fullRange(c), 0);
  return {
    count: rows.length,
    bullish,
    bearish: rows.length - bullish,
    high: Math.max(...rows.map((c) => c.high)),
    low: Math.min(...rows.map((c) => c.low)),
    first,
    last,
    changePercent: first === 0 ? 0 : ((last - first) / first) * 100,
    averageRange: totalRange / rows.length,
  };
}

/**
 * 数値の時系列を、期間ごとにまとめてローソク足にする。
 *
 * @remarks
 * **社内業務で一番使う入口。** 「1 日 1 件の在庫数」しか無くても、
 * 週ごとにまとめれば「その週にどれだけ振れたか」が見える。
 *
 * @param points 値の時系列(`label` は期間のラベル)
 * @param size 1 本にまとめる件数(例: 5 なら 5 件で 1 本)
 * @returns ローソク足。**端数は最後の 1 本にまとめる**(捨てない)
 */
export function toCandles(points: readonly { label: string; value: number }[], size: number): CandleRow[] {
  if (size <= 0 || points.length === 0) return [];
  const out: CandleRow[] = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size);
    const values = chunk.map((p) => p.value);
    out.push({
      label: `${chunk[0]!.label}〜${chunk[chunk.length - 1]!.label}`,
      open: values[0]!,
      close: values[values.length - 1]!,
      high: Math.max(...values),
      low: Math.min(...values),
    });
  }
  return out;
}
