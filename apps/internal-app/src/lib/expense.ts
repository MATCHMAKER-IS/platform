/**
 * 経費集計ロジック。`@platform/utils` `@platform/datetime` を組み合わせて
 * 月次・カテゴリ別集計、外れ値検出、サマリを算出する純ロジック。
 * @packageDocumentation
 */
import { sum, mean, median, outliers as detectOutliers } from "@platform/utils";
import { quarter as quarterOf } from "@platform/datetime";

/** 経費 1 件。 */
export interface Expense {
  id: string;
  /** 発生日(YYYY-MM-DD)。 */
  date: string;
  category: string;
  /** 金額(円)。 */
  amount: number;
  note?: string;
}

/** 月次合計。 */
export interface MonthTotal { month: string; total: number; count: number }
/** カテゴリ別合計。 */
export interface CategoryTotal { category: string; total: number; count: number; share: number }

/** YYYY-MM を取り出す。 */
export function monthKey(dateIso: string): string { return dateIso.slice(0, 7); }

/** 四半期キー(例: 2024-Q1)。 */
export function quarterKey(dateIso: string): string {
  const y = dateIso.slice(0, 4);
  const q = quarterOf(new Date(`${dateIso}T00:00:00Z`));
  return `${y}-Q${q}`;
}

/** 月次合計(昇順)。 */
export function totalByMonth(expenses: readonly Expense[]): MonthTotal[] {
  const map = new Map<string, number[]>();
  for (const e of expenses) {
    const k = monthKey(e.date);
    (map.get(k) ?? map.set(k, []).get(k)!).push(e.amount);
  }
  return [...map.entries()]
    .map(([month, amounts]) => ({ month, total: sum(amounts), count: amounts.length }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** カテゴリ別合計(金額降順・構成比つき)。 */
export function totalByCategory(expenses: readonly Expense[]): CategoryTotal[] {
  const map = new Map<string, number[]>();
  for (const e of expenses) {
    const k = e.category;
    (map.get(k) ?? map.set(k, []).get(k)!).push(e.amount);
  }
  const grand = sum(expenses.map((e) => e.amount));
  return [...map.entries()]
    .map(([category, amounts]) => ({ category, total: sum(amounts), count: amounts.length, share: grand === 0 ? 0 : sum(amounts) / grand }))
    .sort((a, b) => b.total - a.total);
}

/** 金額の外れ値になっている経費(IQR 法)。 */
export function outlierExpenses(expenses: readonly Expense[], k = 1.5): Expense[] {
  const amounts = expenses.map((e) => e.amount);
  const set = new Set(detectOutliers(amounts, k));
  return expenses.filter((e) => set.has(e.amount));
}

/** 経費サマリ。 */
export interface ExpenseSummary {
  total: number;
  count: number;
  average: number;
  median: number;
  byMonth: MonthTotal[];
  byCategory: CategoryTotal[];
  outliers: Expense[];
}

/** 経費全体のサマリを算出する。 */
export function summarize(expenses: readonly Expense[]): ExpenseSummary {
  const amounts = expenses.map((e) => e.amount);
  return {
    total: sum(amounts),
    count: expenses.length,
    average: expenses.length ? mean(amounts) : 0,
    median: expenses.length ? median(amounts) : 0,
    byMonth: totalByMonth(expenses),
    byCategory: totalByCategory(expenses),
    outliers: outlierExpenses(expenses),
  };
}
