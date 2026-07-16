/**
 * 経費の月次レポート生成(純)。`@platform/report` の月次集計・HTML/シート生成を
 * アプリの Expense 型に橋渡しする。
 * @packageDocumentation
 */
import {
  monthlyExpenseSummary, renderMonthlyReportHtml, monthlyReportSheets,
  type MonthlySummary, type ReportLocale, type ExpenseRecord,
} from "@platform/report";
import type { Expense } from "./expense";

/** アプリの Expense を経費記録(税込・既定税率10%)に変換する。 */
export function toExpenseRecords(expenses: readonly Expense[], taxRate = 10): ExpenseRecord[] {
  return expenses.map((e) => ({ amount: e.amount, date: e.date, category: e.category, note: e.note, taxRate }));
}

/** 対象月(YYYY-MM)の一覧を新しい順で返す。 */
export function availableMonths(expenses: readonly Expense[]): string[] {
  return [...new Set(expenses.map((e) => e.date.slice(0, 7)))].sort().reverse();
}

/** 月次レポート(集計 + 印刷用 HTML + シート)。 */
export interface MonthlyReport {
  summary: MonthlySummary;
  html: string;
  sheets: { name: string; rows: Record<string, string | number>[]; freezeHeader: boolean }[];
}

/** 指定月の月次レポートを生成する。 */
export function buildMonthlyReport(expenses: readonly Expense[], yearMonth: string, options: { locale?: ReportLocale } = {}): MonthlyReport {
  const records = toExpenseRecords(expenses);
  const summary = monthlyExpenseSummary(records, yearMonth);
  return {
    summary,
    html: renderMonthlyReportHtml(summary, options),
    sheets: monthlyReportSheets(summary),
  };
}
