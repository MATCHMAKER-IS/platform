/**
 * 給与明細 PDF 出力(@platform/pdf × @platform/payroll)。
 * 給与計算 → 明細組み立て → HTML 描画 → PDF 化の結線例。
 * @packageDocumentation
 */
import { buildPayslip, renderPayslipHtml, type PayBreakdown, type PayslipItem } from "@platform/payroll";
import { createPdf, DEFAULT_INVOICE_PDF_OPTIONS, type PdfRenderer } from "@platform/pdf";

/** 給与明細を PDF バイト列にする。renderer はアプリが用意。 */
export async function payslipToPdf(
  breakdown: PayBreakdown,
  options: { allowances?: PayslipItem[]; deductions?: PayslipItem[]; employeeName?: string; period?: string; companyName?: string },
  renderer: PdfRenderer,
) {
  const payslip = buildPayslip(breakdown, { allowances: options.allowances, deductions: options.deductions });
  const html = renderPayslipHtml(payslip, { employeeName: options.employeeName, period: options.period, companyName: options.companyName });
  return createPdf(renderer).fromHtml(html, DEFAULT_INVOICE_PDF_OPTIONS);
}
