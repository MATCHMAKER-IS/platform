/**
 * ダッシュボード用の月次トレンド。請求を発行月で集計し、売上と売掛残高の推移を出す。基盤 trend.ts の monthRange を再利用。
 * @packageDocumentation
 */
import { monthRange } from "./trend";

/** トレンド算出に使う請求の最小形。 */
export interface TrendInvoiceLike {
  issueDate: string;
  total: number;
  balance: number;
  cancelled?: boolean;
}

/** 月次トレンドの 1 点。 */
export interface TrendPoint {
  month: string;
  sales: number;
  outstanding: number;
}

/** 直近 n か月の月リスト（YYYY-MM・古い順）を作る。 */
export function recentMonths(now: Date, n: number): string[] {
  const to = now.toISOString().slice(0, 7);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1), 1));
  const from = start.toISOString().slice(0, 7);
  return monthRange(from, to);
}

/** 請求から月次の売上・売掛残高トレンドを作る。 */
export function salesTrend(invoices: TrendInvoiceLike[], months: string[]): TrendPoint[] {
  const salesByMonth = new Map<string, number>();
  const outByMonth = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.cancelled) continue;
    const m = inv.issueDate.slice(0, 7);
    salesByMonth.set(m, (salesByMonth.get(m) ?? 0) + inv.total);
    outByMonth.set(m, (outByMonth.get(m) ?? 0) + inv.balance);
  }
  return months.map((month) => ({ month, sales: salesByMonth.get(month) ?? 0, outstanding: outByMonth.get(month) ?? 0 }));
}

/** トレンドの要約（合計売上・平均売上・最大月）。 */
export function summarizeSalesTrend(points: TrendPoint[]): { totalSales: number; avgSales: number; peakMonth: string | null } {
  if (points.length === 0) return { totalSales: 0, avgSales: 0, peakMonth: null };
  const total = points.reduce((s, p) => s + p.sales, 0);
  const peak = points.reduce((a, b) => (b.sales > a.sales ? b : a));
  return { totalSales: total, avgSales: Math.round(total / points.length), peakMonth: peak.sales > 0 ? peak.month : null };
}

/** 直近 n か月の期間（from/to の YYYY-MM）を返す。 */
export function rangeForMonths(now: Date, n: number): { from: string; to: string } {
  const months = recentMonths(now, n);
  return { from: months[0]!, to: months[months.length - 1]! };
}

// ── 支出トレンド（仕入・経費）──

/** 仕入の最小形。 */
export interface TrendPurchaseLike {
  orderDate: string;
  net: number;
  cancelled?: boolean;
}

/** 経費の最小形。 */
export interface TrendExpenseLike {
  date: string;
  amount: number;
}

/** 支出トレンドの 1 点。 */
export interface SpendPoint {
  month: string;
  purchases: number;
  expenses: number;
}

/** 仕入・経費から月次の支出トレンドを作る。 */
export function spendTrend(purchases: TrendPurchaseLike[], expenses: TrendExpenseLike[], months: string[]): SpendPoint[] {
  const pByMonth = new Map<string, number>();
  const eByMonth = new Map<string, number>();
  for (const p of purchases) {
    if (p.cancelled) continue;
    const m = p.orderDate.slice(0, 7);
    pByMonth.set(m, (pByMonth.get(m) ?? 0) + p.net);
  }
  for (const e of expenses) {
    const m = e.date.slice(0, 7);
    eByMonth.set(m, (eByMonth.get(m) ?? 0) + e.amount);
  }
  return months.map((month) => ({ month, purchases: pByMonth.get(month) ?? 0, expenses: eByMonth.get(month) ?? 0 }));
}
