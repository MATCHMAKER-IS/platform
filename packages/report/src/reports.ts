/**
 * 統合レポート(純ロジック・整形専用)。会計・在庫などの集計結果を、
 * xlsx/csv に出せる共通のシート形式に整形する。集計は各ドメインパッケージが行う。
 * @packageDocumentation
 */

/** 出力シート(xlsx の 1 シート相当）。 */
export interface ReportSheet {
  name: string;
  rows: Record<string, string | number>[];
  freezeHeader: boolean;
}

/** 試算表(勘定科目別 借方/貸方/残高）をシートにする。 */
export function trialBalanceSheet(balances: { account: string; debit: number; credit: number; balance: number }[]): ReportSheet {
  const rows = balances.map((b) => ({ 勘定科目: b.account, 借方: b.debit, 貸方: b.credit, 残高: b.balance }));
  const totalDebit = balances.reduce((s, b) => s + b.debit, 0);
  const totalCredit = balances.reduce((s, b) => s + b.credit, 0);
  rows.push({ 勘定科目: "合計", 借方: totalDebit, 貸方: totalCredit, 残高: totalDebit - totalCredit });
  return { name: "試算表", rows, freezeHeader: true };
}

/** 売掛金年齢表をシートにする。 */
export function agingSheet(buckets: { current: number; d1_30: number; d31_60: number; d61_90: number; over90: number; total: number }): ReportSheet {
  return {
    name: "売掛金年齢表", freezeHeader: true,
    rows: [
      { 区分: "未到来", 金額: buckets.current },
      { 区分: "1-30日超過", 金額: buckets.d1_30 },
      { 区分: "31-60日超過", 金額: buckets.d31_60 },
      { 区分: "61-90日超過", 金額: buckets.d61_90 },
      { 区分: "90日超過", 金額: buckets.over90 },
      { 区分: "合計", 金額: buckets.total },
    ],
  };
}

/** 消費税集計表をシートにする。 */
export function taxReportSheet(report: { byRate: { rate: number; salesNet: number; outputTax: number; purchaseNet: number; inputTax: number }[]; outputTax: number; inputTax: number; netPayable: number }): ReportSheet {
  const rows: Record<string, string | number>[] = report.byRate.map((r) => ({ 税率: `${r.rate}%`, 課税売上: r.salesNet, 仮受消費税: r.outputTax, 課税仕入: r.purchaseNet, 仮払消費税: r.inputTax }));
  rows.push({ 税率: "合計", 課税売上: "", 仮受消費税: report.outputTax, 課税仕入: "", 仮払消費税: report.inputTax });
  rows.push({ 税率: "納付税額", 課税売上: "", 仮受消費税: report.netPayable, 課税仕入: "", 仮払消費税: "" });
  return { name: "消費税集計表", rows, freezeHeader: true };
}

/** 在庫評価表をシートにする。 */
export function inventoryValuationSheet(items: { item: string; onHand: number; averageCost: number; value: number }[]): ReportSheet {
  const rows: Record<string, string | number>[] = items.map((i) => ({ 品目: i.item, 在庫数: i.onHand, 平均単価: i.averageCost, 在庫金額: i.value }));
  rows.push({ 品目: "合計", 在庫数: "", 平均単価: "", 在庫金額: items.reduce((s, i) => s + i.value, 0) });
  return { name: "在庫評価表", rows, freezeHeader: true };
}

/** 複数シートを 1 つのブック(xlsx へ渡す形)にまとめる。 */
export function combineSheets(...sheets: ReportSheet[]): ReportSheet[] {
  return sheets.filter((s) => s.rows.length > 0);
}

/** シートを CSV 文字列にする(単票 CSV 出力用・簡易）。 */
export function sheetToCsv(sheet: ReportSheet): string {
  if (sheet.rows.length === 0) return "";
  const headers = Object.keys(sheet.rows[0]!);
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...sheet.rows.map((r) => headers.map((h) => escape(r[h] ?? "")).join(","))];
  return lines.join("\n");
}
