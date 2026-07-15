/**
 * 月次推移・経営分析（アプリ側の組み合わせ）。請求（売上）・仕入・経費を月ごとに集計し、
 * 売上・原価・経費・粗利のトレンドを作る。純粋な組み立てのみ。
 * @packageDocumentation
 */

/** 月次トレンドの入力レコード。 */
export interface TrendInvoice { issueDate: string; net: number; cancelled: boolean; }
export interface TrendPurchase { orderDate: string; net: number; cancelled: boolean; }
export interface TrendExpense { date: string; amount: number; }

/** 1 か月分の集計。 */
export interface MonthPoint {
  month: string;
  sales: number;
  purchases: number;
  expenses: number;
  /** 粗利（売上 − 仕入 − 経費）。 */
  profit: number;
}

/** from〜to（いずれも YYYY-MM）の月リストを作る（両端含む・最大 36 か月）。 */
export function monthRange(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  let guard = 0;
  while ((y < ty || (y === ty && m <= tm)) && guard < 36) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    guard += 1;
  }
  return months;
}

const inMonth = (iso: string, month: string): boolean => iso.slice(0, 7) === month;

/** 月ごとに売上・仕入・経費・粗利を集計する。 */
export function monthlyTrend(invoices: TrendInvoice[], purchases: TrendPurchase[], expenses: TrendExpense[], months: string[]): MonthPoint[] {
  return months.map((month) => {
    const sales = invoices.filter((i) => !i.cancelled && inMonth(i.issueDate, month)).reduce((s, i) => s + i.net, 0);
    const purch = purchases.filter((p) => !p.cancelled && inMonth(p.orderDate, month)).reduce((s, p) => s + p.net, 0);
    const exp = expenses.filter((e) => inMonth(e.date, month)).reduce((s, e) => s + e.amount, 0);
    return { month, sales, purchases: purch, expenses: exp, profit: sales - purch - exp };
  });
}

/** トレンドの合計・平均・直近との増減。 */
export interface TrendSummary {
  totalSales: number;
  totalProfit: number;
  avgProfit: number;
  /** 直近月と前月の粗利の差（データが1点以下なら0）。 */
  profitMoM: number;
}

/** トレンド配列を要約する。 */
export function summarizeTrend(points: MonthPoint[]): TrendSummary {
  const totalSales = points.reduce((s, p) => s + p.sales, 0);
  const totalProfit = points.reduce((s, p) => s + p.profit, 0);
  const n = points.length;
  const last = n >= 1 ? points[n - 1]!.profit : 0;
  const prev = n >= 2 ? points[n - 2]!.profit : 0;
  return { totalSales, totalProfit, avgProfit: n > 0 ? Math.round(totalProfit / n) : 0, profitMoM: n >= 2 ? last - prev : 0 };
}
