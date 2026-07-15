/**
 * 資金繰り（営業キャッシュフロー）の月次集計（アプリ側の組み合わせ）。
 * 実際の入金・支払（日付つき）から、月ごとの現金収入・支出・収支・累計残を出す。純粋な組み立てのみ。
 * @packageDocumentation
 */

/** 日付つきの現金移動。 */
export interface CashMovement {
  date: string;
  amount: number;
}

/** 1 か月分の資金繰り。 */
export interface CashFlowRow {
  month: string;
  inflow: number;
  outflow: number;
  /** 当月収支（収入 − 支出）。 */
  net: number;
  /** 期首からの累計収支。 */
  cumulative: number;
}

const inMonth = (iso: string, month: string): boolean => iso.slice(0, 7) === month;
const sumIn = (moves: CashMovement[], month: string): number => moves.filter((m) => inMonth(m.date, month)).reduce((s, m) => s + m.amount, 0);

/** 入金・支払を月ごとに集計し、収支と累計残を出す（opening は期首残高）。 */
export function monthlyCashFlow(inflows: CashMovement[], outflows: CashMovement[], months: string[], opening = 0): CashFlowRow[] {
  let cumulative = opening;
  return months.map((month) => {
    const inflow = sumIn(inflows, month);
    const outflow = sumIn(outflows, month);
    const net = inflow - outflow;
    cumulative += net;
    return { month, inflow, outflow, net, cumulative };
  });
}

/** 資金繰りサマリー。 */
export interface CashFlowSummary {
  totalIn: number;
  totalOut: number;
  /** 純キャッシュフロー（総収入 − 総支出）。 */
  netCashFlow: number;
  /** 期末残高（opening + 純CF）。 */
  ending: number;
}

/** 資金繰り行を要約する。 */
export function summarizeCashFlow(rows: CashFlowRow[], opening = 0): CashFlowSummary {
  const totalIn = rows.reduce((s, r) => s + r.inflow, 0);
  const totalOut = rows.reduce((s, r) => s + r.outflow, 0);
  return { totalIn, totalOut, netCashFlow: totalIn - totalOut, ending: opening + totalIn - totalOut };
}
