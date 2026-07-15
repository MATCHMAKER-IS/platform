/**
 * 帳票 HTML の生成(印刷可能・A4)。`@platform/pdf` の `fromHtml` に渡して PDF 化する。
 * @packageDocumentation
 */
import { calculateInvoice, type InvoiceLineInput, type InvoiceCalcOptions } from "./invoice.js";
import { formatYen } from "./money.js";

/** 対応ロケール。 */
export type ReportLocale = "ja" | "en" | "zh" | "ko";
const LOCALE_TAG: Record<ReportLocale, string> = { ja: "ja-JP", en: "en-US", zh: "zh-CN", ko: "ko-KR" };
function invoiceMoney(locale: ReportLocale | undefined): (v: number) => string {
  if (!locale) return formatYen;
  const nf = new Intl.NumberFormat(LOCALE_TAG[locale], { style: "currency", currency: "JPY" });
  return (v) => nf.format(v);
}

/** 取引先(自社・請求先)情報。 */
export interface Party {
  name: string;
  address?: string;
  tel?: string;
  /** 適格請求書発行事業者の登録番号(T+13桁)。自社側に記載。 */
  registrationNumber?: string;
}

/** 請求書ドキュメント。 */
export interface InvoiceDocument extends InvoiceCalcOptions {
  /** 請求書番号。 */
  invoiceNumber: string;
  /** 発行日(表示用文字列)。 */
  issueDate: string;
  /** 支払期限(任意)。 */
  dueDate?: string;
  /** 自社(発行者)。 */
  seller: Party;
  /** 請求先。 */
  buyer: Party;
  /** 明細。 */
  lines: InvoiceLineInput[];
  /** 備考。 */
  notes?: string;
  /** タイトル(既定は documentType に応じて 請求書/見積書/納品書)。 */
  title?: string;
  /** 帳票種別(ラベルが変わる。既定 "invoice")。 */
  documentType?: "invoice" | "quotation" | "delivery";
  /** 源泉徴収税額(円)。指定すると源泉徴収と差引お支払額を表示。計算は @platform/tax の withholdingTax で。 */
  withholding?: number;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/**
 * 請求書の印刷用 HTML を生成する。インボイス制度の記載事項(登録番号・税率ごとの
 * 区分・税率ごとの消費税額)を含む。
 *
 * @example
 * ```ts
 * const html = renderInvoiceHtml(doc);
 * const pdf = await createPdf(renderer).fromHtml(html, { format: "A4" });
 * ```
 */
export function renderInvoiceHtml(doc: InvoiceDocument, options: { locale?: ReportLocale } = {}): string {
  const yen = invoiceMoney(options.locale);
  const numLoc = options.locale ? LOCALE_TAG[options.locale] : "ja-JP";
  const calc = calculateInvoice({ lines: doc.lines, taxMode: doc.taxMode, rounding: doc.rounding });
  const docType = doc.documentType ?? "invoice";
  const LABELS = {
    invoice: { title: "請求書", number: "請求書番号", grand: "ご請求金額", due: "支払期限" },
    quotation: { title: "見積書", number: "見積番号", grand: "お見積金額", due: "有効期限" },
    delivery: { title: "納品書", number: "納品書番号", grand: "納品金額", due: "納品日" },
  } as const;
  const L = LABELS[docType];
  const title = doc.title ?? L.title;
  const modeLabel = (doc.taxMode ?? "exclusive") === "inclusive" ? "税込" : "税抜";

  const lineRows = calc.lines
    .map(
      (l) => `<tr>
        <td>${esc(l.description)}</td>
        <td class="num">${l.quantity.toLocaleString(numLoc)}${l.unit ? esc(l.unit) : ""}</td>
        <td class="num">${yen(l.unitPrice)}</td>
        <td class="num">${l.taxRate}%</td>
        <td class="num">${yen(l.amount)}</td>
      </tr>`,
    )
    .join("");

  const taxRows = calc.taxBreakdown
    .map(
      (t) => `<tr>
        <td>${t.rate}% 対象</td>
        <td class="num">${yen(t.taxableAmount)}</td>
        <td class="num">${yen(t.taxAmount)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><title>${esc(title)} ${esc(doc.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic",sans-serif; color:#0f172a; margin:0; padding:24px; font-size:12px; }
  h1 { font-size:22px; letter-spacing:.3em; text-align:center; margin:0 0 16px; }
  .head { display:flex; justify-content:space-between; margin-bottom:16px; }
  .box { line-height:1.7; }
  .box .name { font-size:15px; font-weight:700; border-bottom:1px solid #0f172a; padding-bottom:2px; }
  .muted { color:#64748b; }
  table { width:100%; border-collapse:collapse; margin-top:8px; }
  th,td { border:1px solid #cbd5e1; padding:6px 8px; }
  th { background:#f1f5f9; text-align:left; }
  td.num, th.num { text-align:right; }
  .total-box { margin-top:12px; display:flex; justify-content:flex-end; }
  .total-box table { width:auto; min-width:260px; }
  .grand { font-size:15px; font-weight:700; background:#f8fafc; }
  .notes { margin-top:16px; white-space:pre-wrap; }
  .reg { font-size:11px; }
</style></head>
<body>
  <h1>${esc(title)}</h1>
  <div class="head">
    <div class="box">
      <div class="name">${esc(doc.buyer.name)} 御中</div>
      ${doc.buyer.address ? `<div class="muted">${esc(doc.buyer.address)}</div>` : ""}
    </div>
    <div class="box" style="text-align:right">
      <div>${L.number}: ${esc(doc.invoiceNumber)}</div>
      <div>発行日: ${esc(doc.issueDate)}</div>
      ${doc.dueDate ? `<div>${L.due}: ${esc(doc.dueDate)}</div>` : ""}
      <div style="margin-top:8px" class="name">${esc(doc.seller.name)}</div>
      ${doc.seller.address ? `<div class="muted">${esc(doc.seller.address)}</div>` : ""}
      ${doc.seller.tel ? `<div class="muted">TEL: ${esc(doc.seller.tel)}</div>` : ""}
      ${doc.seller.registrationNumber ? `<div class="reg">登録番号: ${esc(doc.seller.registrationNumber)}</div>` : ""}
    </div>
  </div>

  <div class="grand" style="padding:8px 12px;border:1px solid #cbd5e1;display:inline-block;">
    ${L.grand}(税込): <strong style="font-size:18px">${yen(calc.total)}</strong>
  </div>

  <table>
    <thead><tr><th>品目</th><th class="num">数量</th><th class="num">単価(${modeLabel})</th><th class="num">税率</th><th class="num">金額</th></tr></thead>
    <tbody>${lineRows}</tbody>
  </table>

  <div class="total-box">
    <table>
      <tr><td>小計(税抜)</td><td class="num">${yen(calc.subtotal)}</td></tr>
      ${calc.taxBreakdown.map((t) => `<tr><td>消費税(${t.rate}%)</td><td class="num">${yen(t.taxAmount)}</td></tr>`).join("")}
      <tr class="grand"><td>合計(税込)</td><td class="num">${yen(calc.total)}</td></tr>
      ${typeof doc.withholding === "number" && doc.withholding > 0 ? `<tr><td>源泉徴収税</td><td class="num">-${yen(doc.withholding)}</td></tr><tr class="grand"><td>差引お支払額</td><td class="num">${yen(calc.total - doc.withholding)}</td></tr>` : ""}
    </table>
  </div>

  <table style="margin-top:16px;width:auto">
    <thead><tr><th>税率区分</th><th class="num">対象額(税抜)</th><th class="num">消費税額</th></tr></thead>
    <tbody>${taxRows}</tbody>
  </table>

  ${doc.notes ? `<div class="notes"><strong>備考</strong>\n${esc(doc.notes)}</div>` : ""}
</body></html>`;
}

/** 見積書の印刷用 HTML を生成する(renderInvoiceHtml の見積書ラベル版)。 */
export function renderQuotationHtml(doc: InvoiceDocument, options: { locale?: ReportLocale } = {}): string {
  return renderInvoiceHtml({ ...doc, documentType: "quotation" }, options);
}

/** 納品書の印刷用 HTML を生成する(renderInvoiceHtml の納品書ラベル版)。 */
export function renderDeliveryNoteHtml(doc: InvoiceDocument, options: { locale?: ReportLocale } = {}): string {
  return renderInvoiceHtml({ ...doc, documentType: "delivery" }, options);
}
