/**
 * 請求書の HTML 描画(純ロジック)。@platform/pdf の fromHtml に渡して PDF 化する。
 * @packageDocumentation
 */
import { type Invoice } from "./invoice";

/** 描画オプション。 */
export interface InvoiceHtmlOptions {
  /** 発行者(自社)名。 */
  issuerName?: string;
  /** 通貨記号(既定 "¥")。 */
  currencySymbol?: string;
}

function yen(n: number, symbol: string): string {
  return `${symbol}${n.toLocaleString("ja-JP")}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const RATE_LABEL: Record<number, string> = { 10: "10%", 8: "8%(軽減)", 0: "0%" };

/**
 * 請求書を A4 想定の HTML 文字列に描画する。
 *
 *
 * @param invoice 請求書
 * @returns HTML(**A4 想定**。印刷用の CSS は `@platform/report` の wrapForPrint で足す)
 */
export function renderInvoiceHtml(invoice: Invoice, options: InvoiceHtmlOptions = {}): string {
  const symbol = options.currencySymbol ?? "¥";
  const rows = invoice.lines
    .map((l) => {
      const net = Math.max(0, l.quantity * l.unitPrice - (l.discount ?? 0));
      return `<tr><td>${esc(l.description)}${l.reducedRate ? " ※" : ""}</td><td class="num">${l.quantity}</td><td class="num">${yen(l.unitPrice, symbol)}</td><td class="num">${RATE_LABEL[l.taxRate ?? 10]}</td><td class="num">${yen(net, symbol)}</td></tr>`;
    })
    .join("");
  const taxRows = invoice.totals.taxByRate
    .map((r) => `<tr><td>${RATE_LABEL[r.rate]} 対象</td><td class="num">${yen(r.net, symbol)}</td><td class="num">${yen(r.tax, symbol)}</td></tr>`)
    .join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
body{font-family:"Hiragino Sans","Noto Sans JP",sans-serif;color:#111;font-size:12px}
h1{font-size:20px;margin:0 0 16px}
.meta{display:flex;justify-content:space-between;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}
.num{text-align:right}
.total{font-size:16px;font-weight:bold}
.reg{color:#555;font-size:11px}
</style></head><body>
<h1>請求書</h1>
<div class="meta">
  <div>
    <div>${esc(invoice.billTo)} 御中</div>
  </div>
  <div>
    <div>請求書番号: ${esc(invoice.number)}</div>
    <div>発行日: ${esc(invoice.issueDate)}</div>
    <div>支払期限: ${esc(invoice.dueDate)}</div>
    ${options.issuerName ? `<div>${esc(options.issuerName)}</div>` : ""}
    ${invoice.registrationNumber ? `<div class="reg">登録番号: ${esc(invoice.registrationNumber)}</div>` : ""}
  </div>
</div>
<table>
  <thead><tr><th>品目</th><th class="num">数量</th><th class="num">単価</th><th class="num">税率</th><th class="num">金額(税抜)</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<table>
  <thead><tr><th>税率区分</th><th class="num">対象額(税抜)</th><th class="num">消費税</th></tr></thead>
  <tbody>${taxRows}</tbody>
</table>
<table>
  <tbody>
    <tr><td>小計(税抜)</td><td class="num">${yen(invoice.totals.subtotal, symbol)}</td></tr>
    <tr><td>消費税</td><td class="num">${yen(invoice.totals.tax, symbol)}</td></tr>
    <tr class="total"><td>合計(税込)</td><td class="num">${yen(invoice.totals.total, symbol)}</td></tr>
  </tbody>
</table>
</body></html>`;
}
