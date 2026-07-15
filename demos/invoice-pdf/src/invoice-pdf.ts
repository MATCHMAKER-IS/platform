/**
 * 請求書 PDF 出力の実結線例(@platform/pdf × @platform/invoice)。
 * invoice を HTML に描画(renderInvoiceHtml)し、pdf の fromHtml で PDF 化する。
 * @packageDocumentation
 */
import { buildInvoice, renderInvoiceHtml, type Invoice, type InvoiceLine } from "@platform/invoice";
import { createPdf, DEFAULT_INVOICE_PDF_OPTIONS, type PdfRenderer } from "@platform/pdf";

/** 請求書を PDF バイト列にする。renderer はアプリが用意(例: createPlaywrightRenderer)。 */
export async function invoiceToPdf(invoice: Invoice, renderer: PdfRenderer, issuerName?: string) {
  const html = renderInvoiceHtml(invoice, { issuerName });
  const service = createPdf(renderer);
  return service.fromHtml(html, DEFAULT_INVOICE_PDF_OPTIONS);
}

/** 明細から請求書を組み立てて PDF 化する一括関数。 */
export async function issueInvoicePdf(
  header: { number: string; issueDate: string; dueDate: string; billTo: string; registrationNumber?: string },
  lines: InvoiceLine[],
  renderer: PdfRenderer,
  issuerName?: string,
) {
  const invoice = buildInvoice(header, lines);
  return invoiceToPdf(invoice, renderer, issuerName);
}
