/**
 * 月次締めレポート。経費記録を月で集計し、科目別・税率別の内訳と印刷用 HTML を生成する。
 * @packageDocumentation
 */
import { expenseTaxBreakdown, type ExpenseRecord } from "./expense";
import { formatYen } from "./money";

/** 対応ロケール。 */
import type { ReportLocale } from "./render";
export type { ReportLocale };
const LOCALE_TAG: Record<ReportLocale, string> = { ja: "ja-JP", en: "en-US", zh: "zh-CN", ko: "ko-KR" };

function moneyFmt(locale: ReportLocale | undefined): (v: number) => string {
  if (!locale) return formatYen;
  const nf = new Intl.NumberFormat(LOCALE_TAG[locale], { style: "currency", currency: "JPY" });
  return (v) => nf.format(v);
}
function monthLabel(yearMonth: string, locale: ReportLocale | undefined): string {
  if (!locale) return yearMonth;
  const [y, m] = yearMonth.split("-").map(Number);
  if (!y || !m) return yearMonth;
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], { year: "numeric", month: "long" }).format(new Date(y, m - 1, 1));
}

/** 月次集計。 */
export interface MonthlySummary {
  yearMonth: string;
  count: number;
  total: number;
  subtotal: number;
  tax: number;
  byCategory: { category: string; total: number; count: number }[];
  byTaxRate: { rate: number; subtotal: number; tax: number; total: number }[];
}

/**
 * 指定した年月の経費を集計する。
 *
 * @param records 経費記録
 * @param yearMonth 年月(`YYYY-MM`)
 * @returns その月の集計(件数・合計・カテゴリ別)
 */
export function monthlyExpenseSummary(records: ExpenseRecord[], yearMonth: string): MonthlySummary {
  const inMonth = records.filter((r) => (r.date ?? "").startsWith(yearMonth));
  const catMap = new Map<string, { total: number; count: number }>();
  const rateMap = new Map<number, { subtotal: number; tax: number; total: number }>();
  let total = 0, subtotal = 0, tax = 0;

  for (const r of inMonth) {
    const b = expenseTaxBreakdown(r);
    total += b.total; subtotal += b.subtotal; tax += b.tax;
    const cat = r.category ?? "未分類";
    const c = catMap.get(cat) ?? { total: 0, count: 0 };
    c.total += b.total; c.count += 1; catMap.set(cat, c);
    const rt = rateMap.get(b.rate) ?? { subtotal: 0, tax: 0, total: 0 };
    rt.subtotal += b.subtotal; rt.tax += b.tax; rt.total += b.total; rateMap.set(b.rate, rt);
  }

  return {
    yearMonth,
    count: inMonth.length,
    total, subtotal, tax,
    byCategory: [...catMap.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total),
    byTaxRate: [...rateMap.entries()].map(([rate, v]) => ({ rate, ...v })).sort((a, b) => a.rate - b.rate),
  };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/**
 * 月次締めレポートの印刷用 HTML を生成する。
 *
 * @param summary 月次の集計
 * @returns 印刷用の HTML
 */
export function renderMonthlyReportHtml(summary: MonthlySummary, options: { locale?: ReportLocale } = {}): string {
  const yen = moneyFmt(options.locale);
  const ymLabel = monthLabel(summary.yearMonth, options.locale);
  const catRows = summary.byCategory.map((c) => `<tr><td>${esc(c.category)}</td><td style="text-align:right">${c.count}</td><td style="text-align:right">${yen(c.total)}</td></tr>`).join("");
  const rateRows = summary.byTaxRate.map((r) => `<tr><td>${r.rate}%</td><td style="text-align:right">${yen(r.subtotal)}</td><td style="text-align:right">${yen(r.tax)}</td><td style="text-align:right">${yen(r.total)}</td></tr>`).join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>月次締めレポート ${esc(summary.yearMonth)}</title>
<style>
  body{font-family:"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;color:#0f172a;padding:24px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px} .sub{color:#64748b;margin:0 0 16px}
  table{border-collapse:collapse;width:100%;max-width:560px;margin-bottom:20px}
  th,td{border:1px solid #cbd5e1;padding:6px 10px;text-align:left} th{background:#f1f5f9}
  .kpi{display:flex;gap:16px;margin-bottom:16px} .kpi div{border:1px solid #e2e8f0;border-radius:8px;padding:10px 16px}
  .kpi b{display:block;font-size:18px}
</style></head><body>
  <h1>月次締めレポート</h1>
  <p class="sub">${esc(ymLabel)} / ${summary.count} 件</p>
  <div class="kpi">
    <div>税込合計<b>${yen(summary.total)}</b></div>
    <div>税抜<b>${yen(summary.subtotal)}</b></div>
    <div>消費税<b>${yen(summary.tax)}</b></div>
  </div>
  <h2>科目別</h2>
  <table><thead><tr><th>科目</th><th>件数</th><th>税込</th></tr></thead><tbody>${catRows}</tbody></table>
  <h2>税率別</h2>
  <table><thead><tr><th>税率</th><th>税抜</th><th>消費税</th><th>税込</th></tr></thead><tbody>${rateRows}</tbody></table>
</body></html>`;
}

/**
 * 月次レポートをシートの配列に変換する。
 *
 * @param summary 月次の集計
 * @returns シートの配列。`@platform/xlsx` の `writeWorkbook` にそのまま渡せる
 */
export function monthlyReportSheets(summary: MonthlySummary): { name: string; rows: Record<string, string | number>[]; freezeHeader: boolean }[] {
  return [
    {
      name: "サマリ", freezeHeader: true,
      rows: [
        { 項目: "対象月", 値: summary.yearMonth },
        { 項目: "件数", 値: summary.count },
        { 項目: "税抜", 値: summary.subtotal },
        { 項目: "消費税", 値: summary.tax },
        { 項目: "税込合計", 値: summary.total },
      ],
    },
    { name: "科目別", freezeHeader: true, rows: summary.byCategory.map((c) => ({ 科目: c.category, 件数: c.count, 税込: c.total })) },
    { name: "税率別", freezeHeader: true, rows: summary.byTaxRate.map((r) => ({ 税率: `${r.rate}%`, 税抜: r.subtotal, 消費税: r.tax, 税込: r.total })) },
  ];
}
