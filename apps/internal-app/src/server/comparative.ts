/**
 * 複数年度の比較決算（アプリ側の組み合わせ）。当期と前期の損益・貸借を並べ、増減・増減率を出す。純粋な組み立てのみ。
 * @packageDocumentation
 */
import { type ProfitAndLoss, type BalanceSheet } from "@platform/accounting";

/** 当期・前期・増減・増減率の 1 組。 */
export interface Comparison {
  current: number;
  prior: number;
  /** 増減（当期 − 前期）。 */
  delta: number;
  /** 増減率（増減 ÷ 前期。前期0なら null）。 */
  rate: number | null;
}

/** 比較財務諸表。 */
export interface ComparativeStatements {
  years: [number, number];
  revenue: Comparison;
  expense: Comparison;
  netIncome: Comparison;
  assets: Comparison;
  liabilities: Comparison;
  equity: Comparison;
}

/** 財務諸表（損益・貸借）。 */
export interface Statements {
  profitAndLoss: ProfitAndLoss;
  balanceSheet: BalanceSheet;
}

function cmp(current: number, prior: number): Comparison {
  const delta = current - prior;
  return { current, prior, delta, rate: prior !== 0 ? delta / prior : null };
}

/** 当期・前期の財務諸表を比較する。 */
export function compareStatements(currentYear: number, priorYear: number, current: Statements, prior: Statements): ComparativeStatements {
  return {
    years: [currentYear, priorYear],
    revenue: cmp(current.profitAndLoss.revenue, prior.profitAndLoss.revenue),
    expense: cmp(current.profitAndLoss.expense, prior.profitAndLoss.expense),
    netIncome: cmp(current.profitAndLoss.netIncome, prior.profitAndLoss.netIncome),
    assets: cmp(current.balanceSheet.assets, prior.balanceSheet.assets),
    liabilities: cmp(current.balanceSheet.liabilities, prior.balanceSheet.liabilities),
    equity: cmp(current.balanceSheet.equity, prior.balanceSheet.equity),
  };
}
