/**
 * 定型レポート/帳票の生成。売上・売掛・在庫などをレポートデータ（列・行・合計）に集約し、CSV / 印刷用 HTML に整形する。
 * Excel(.xlsx) は既存の @platform/xlsx（writeWorkbook）で出力する（本モジュールは純粋なデータ整形）。
 * @packageDocumentation
 */

/** レポートの列。 */
export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

/** レポート。 */
export interface Report {
  title: string;
  generatedAt: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  totals?: Record<string, string | number>;
}

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`;

/** 売上レポート（請求ベース・取引先別の売上と残高）。 */
export function salesReport(invoices: { number: string; billTo?: string; total: number; balance: number }[], now: Date): Report {
  const byPartner = new Map<string, { total: number; balance: number; count: number }>();
  for (const inv of invoices) {
    const key = inv.billTo || "（不明）";
    const cur = byPartner.get(key) ?? { total: 0, balance: 0, count: 0 };
    cur.total += inv.total;
    cur.balance += inv.balance;
    cur.count += 1;
    byPartner.set(key, cur);
  }
  const rows = [...byPartner.entries()].map(([billTo, v]) => ({ billTo, count: v.count, total: yen(v.total), balance: yen(v.balance) })).sort((a, b) => (a.billTo < b.billTo ? -1 : 1));
  const totalSum = invoices.reduce((s, i) => s + i.total, 0);
  const balanceSum = invoices.reduce((s, i) => s + i.balance, 0);
  return {
    title: "売上レポート（取引先別）",
    generatedAt: now.toISOString(),
    columns: [{ key: "billTo", label: "取引先" }, { key: "count", label: "件数", align: "right" }, { key: "total", label: "売上", align: "right" }, { key: "balance", label: "残高", align: "right" }],
    rows,
    totals: { billTo: "合計", count: invoices.length, total: yen(totalSum), balance: yen(balanceSum) },
  };
}

/** 売掛レポート（未回収の請求一覧・残高）。 */
export function receivablesReport(invoices: { number: string; billTo?: string; balance: number; dueDate?: string; status: string }[], now: Date): Report {
  const unpaid = invoices.filter((i) => i.balance > 0);
  const rows = unpaid.map((i) => ({ number: i.number, billTo: i.billTo || "", dueDate: i.dueDate || "", status: i.status, balance: yen(i.balance) })).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  return {
    title: "売掛レポート（未回収）",
    generatedAt: now.toISOString(),
    columns: [{ key: "number", label: "請求番号" }, { key: "billTo", label: "取引先" }, { key: "dueDate", label: "期日" }, { key: "status", label: "状態" }, { key: "balance", label: "残高", align: "right" }],
    rows,
    totals: { number: "合計", billTo: "", dueDate: "", status: `${unpaid.length}件`, balance: yen(unpaid.reduce((s, i) => s + i.balance, 0)) },
  };
}

/** 在庫レポート（商品別の在庫数・発注要否）。 */
export function inventoryReport(stock: { sku: string; name: string; onHand: number; needsReorder: boolean; suggestedOrderQty: number }[], now: Date): Report {
  const rows = stock.map((s) => ({ sku: s.sku, name: s.name, onHand: s.onHand, reorder: s.needsReorder ? "要" : "", suggested: s.needsReorder ? s.suggestedOrderQty : "" }));
  return {
    title: "在庫レポート",
    generatedAt: now.toISOString(),
    columns: [{ key: "sku", label: "SKU" }, { key: "name", label: "商品名" }, { key: "onHand", label: "在庫数", align: "right" }, { key: "reorder", label: "発注" }, { key: "suggested", label: "推奨発注数", align: "right" }],
    rows,
    totals: { sku: "合計", name: `${stock.length}品目`, onHand: stock.reduce((s, x) => s + x.onHand, 0), reorder: `${stock.filter((s) => s.needsReorder).length}件`, suggested: "" },
  };
}

function esc(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** レポートを CSV 文字列にする（Excel 向け BOM 付き・合計行を含む）。 */
export function reportToCsv(report: Report): string {
  const header = report.columns.map((c) => c.label).join(",");
  const body = report.rows.map((r) => report.columns.map((c) => esc(r[c.key] ?? "")).join(",")).join("\n");
  const total = report.totals ? "\n" + report.columns.map((c) => esc(report.totals![c.key] ?? "")).join(",") : "";
  return "\ufeff" + header + "\n" + body + total + "\n";
}

function h(v: string | number): string {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** レポートを印刷用 HTML にする（PDF 化はブラウザ印刷で）。 */
export function reportToHtml(report: Report): string {
  const cols = report.columns;
  const thead = cols.map((c) => `<th style="text-align:${c.align ?? "left"}">${h(c.label)}</th>`).join("");
  const rows = report.rows.map((r) => `<tr>${cols.map((c) => `<td style="text-align:${c.align ?? "left"}">${h(r[c.key] ?? "")}</td>`).join("")}</tr>`).join("");
  const total = report.totals ? `<tr class="total">${cols.map((c) => `<td style="text-align:${c.align ?? "left"}">${h(report.totals![c.key] ?? "")}</td>`).join("")}</tr>` : "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${h(report.title)}</title><style>
body{font-family:sans-serif;padding:24px;color:#111}h1{font-size:18px}.meta{color:#666;font-size:12px;margin-bottom:12px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f5f5f5}
.total td{font-weight:bold;background:#fafafa}@media print{body{padding:0}}
</style></head><body><h1>${h(report.title)}</h1><div class="meta">生成: ${h(report.generatedAt.slice(0, 19).replace("T", " "))}</div>
<table><thead><tr>${thead}</tr></thead><tbody>${rows}${total}</tbody></table></body></html>`;
}

/** レポートを xlsx 用のシート入力に変換する（@platform/xlsx の writeWorkbook 向け）。 */
export function reportToSheet(report: Report): { name: string; rows: Record<string, string | number>[] } {
  const rows = report.rows.map((r) => {
    const o: Record<string, string | number> = {};
    for (const c of report.columns) o[c.label] = r[c.key] ?? "";
    return o;
  });
  if (report.totals) {
    const t: Record<string, string | number> = {};
    for (const c of report.columns) t[c.label] = report.totals[c.key] ?? "";
    rows.push(t);
  }
  return { name: report.title.slice(0, 28), rows };
}

// ── 絞り込み ──

/** レポートの絞り込み条件。 */
export interface ReportFilter {
  from?: string;
  to?: string;
  partner?: string;
}

/** 請求を期間（発行日）・取引先で絞り込む。 */
export function filterInvoices<T extends { issueDate: string; billTo?: string }>(invoices: T[], filter: ReportFilter): T[] {
  return invoices.filter((inv) => {
    if (filter.from && inv.issueDate < filter.from) return false;
    if (filter.to && inv.issueDate > filter.to) return false;
    if (filter.partner && (inv.billTo ?? "") !== filter.partner) return false;
    return true;
  });
}

/** 絞り込み条件を人間可読な文字列にする（タイトル付記用）。空なら空文字。 */
export function filterLabel(filter: ReportFilter): string {
  const parts: string[] = [];
  if (filter.from || filter.to) parts.push(`${filter.from ?? ""}〜${filter.to ?? ""}`);
  if (filter.partner) parts.push(filter.partner);
  return parts.length > 0 ? `（${parts.join(" / ")}）` : "";
}
