/**
 * 月次決算（アプリ側の組み合わせ）。仕訳から損益計算書・貸借対照表を、
 * 請求・仕入の税率別内訳から消費税集計表を作る。集計ロジックは @platform/accounting に委譲する。
 * @packageDocumentation
 */
import { profitAndLoss, balanceSheet, consumptionTaxSummary, defaultAccountTypes, type ProfitAndLoss, type BalanceSheet, type TaxReport, type RateAmount, type JournalEntry, type AccountTypeMap } from "@platform/accounting";

/** 税率別内訳（税抜・消費税）。 */
export interface TaxByRate {
  rate: number;
  net: number;
  tax: number;
}

/** 財務諸表。 */
export interface FinancialStatements {
  profitAndLoss: ProfitAndLoss;
  balanceSheet: BalanceSheet;
}

/** 仕訳から損益計算書・貸借対照表を作る。extraTypes で既定の勘定科目区分に追加できる（減価償却など）。 */
export function financialStatements(entries: JournalEntry[], extraTypes: AccountTypeMap = {}): FinancialStatements {
  const types: AccountTypeMap = { ...defaultAccountTypes(), ...extraTypes };
  return { profitAndLoss: profitAndLoss(entries, types), balanceSheet: balanceSheet(entries, types) };
}

/** 税率別内訳の配列（請求書・発注の totals.taxByRate 群）を税率ごとに合算して RateAmount[] にする。 */
export function aggregateRates(items: TaxByRate[][]): RateAmount[] {
  const byRate = new Map<number, { net: number; tax: number }>();
  for (const list of items) {
    for (const r of list) {
      const cur = byRate.get(r.rate) ?? { net: 0, tax: 0 };
      cur.net += r.net;
      cur.tax += r.tax;
      byRate.set(r.rate, cur);
    }
  }
  return Array.from(byRate.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([rate, v]) => ({ rate, net: v.net, tax: v.tax }));
}

/** 売上・仕入の税率別内訳から消費税集計表を作る。 */
export function consumptionTax(sales: RateAmount[], purchases: RateAmount[]): TaxReport {
  return consumptionTaxSummary(sales, purchases);
}
