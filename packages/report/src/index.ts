/**
 * `@platform/report` — 帳票(請求書・見積書等)。
 *
 * 日本の消費税計算(税率別・内税/外税・端数処理・インボイス制度準拠)と、
 * 印刷可能な HTML 生成を提供する。HTML は `@platform/pdf` に渡して PDF 化する。
 * 計算ロジックとレンダリングを分離しているので、Web 表示にも PDF にも使える。
 *
 * @packageDocumentation
 */
export { roundAmount, formatYen, multiply, type RoundingMode } from "./money";
export {
  calculateInvoice,
  type InvoiceLineInput, type InvoiceCalcOptions, type InvoiceLine,
  type TaxBreakdown, type InvoiceCalculation,
} from "./invoice";
export { renderInvoiceHtml, renderQuotationHtml, renderDeliveryNoteHtml, type InvoiceDocument, type Party } from "./render";

export { expenseFromReceiptFields, expenseTaxBreakdown, renderExpenseHtml, expenseToRow, type ExpenseRecord, type ExtractedFields, type ExpenseRow } from "./expense";

export { monthlyExpenseSummary, renderMonthlyReportHtml, monthlyReportSheets, type MonthlySummary, type ReportLocale } from "./monthly";
export * from "./print";
export * from "./reports";
