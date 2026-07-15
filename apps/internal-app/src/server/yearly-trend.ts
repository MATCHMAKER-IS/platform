/**
 * 年次推移（アプリ側の組み合わせ）。複数年度の損益を並べ、前年比の伸び率とグラフ描画用の範囲を出す。純粋な組み立てのみ。
 * @packageDocumentation
 */

/** 1 年度分の損益。 */
export interface YearPnl {
  year: number;
  revenue: number;
  expense: number;
  netIncome: number;
}

/** 推移の 1 点（前年比の純利益伸び率つき）。 */
export interface TrendPoint extends YearPnl {
  /** 純利益の前年比伸び率（前年0または初年度は null）。 */
  growth: number | null;
}

/** 年度損益を年順に整え、前年比伸び率を付ける。 */
export function yearlyTrend(points: YearPnl[]): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.year - b.year);
  return sorted.map((p, i) => {
    const prev = i > 0 ? sorted[i - 1] : undefined;
    const growth = prev && prev.netIncome !== 0 ? (p.netIncome - prev.netIncome) / Math.abs(prev.netIncome) : null;
    return { ...p, growth };
  });
}

/** グラフ描画用の最大・最小（売上・費用・純利益を通した範囲。純利益は負にもなりうる）。 */
export function trendRange(points: YearPnl[]): { max: number; min: number } {
  const vals = points.flatMap((p) => [p.revenue, p.expense, p.netIncome]);
  return { max: vals.length ? Math.max(...vals, 0) : 0, min: vals.length ? Math.min(...vals, 0) : 0 };
}

/** 期間合計（売上・費用・純利益）。 */
export function trendTotals(points: YearPnl[]): { revenue: number; expense: number; netIncome: number } {
  return {
    revenue: points.reduce((s, p) => s + p.revenue, 0),
    expense: points.reduce((s, p) => s + p.expense, 0),
    netIncome: points.reduce((s, p) => s + p.netIncome, 0),
  };
}
