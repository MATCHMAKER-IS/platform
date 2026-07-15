/**
 * 請求・見積のアプリ層サービス(基盤 @platform/invoice・@platform/quote の合成)。
 * ドメインの計算は基盤に委ね、ここでは採番・入力の受け渡しなどアプリ都合をまとめる。
 * @packageDocumentation
 */
import { buildInvoice, formatInvoiceNumber, paymentStatus, type InvoiceLine, type Invoice } from "@platform/invoice";
import { buildQuote, quoteStatus, convertToInvoice, type Quote } from "@platform/quote";

/** 請求書の発行入力。 */
export interface IssueInvoiceInput {
  sequence: number;
  issueDate: string;
  termDays: number;
  billTo: string;
  registrationNumber?: string;
  lines: InvoiceLine[];
}

/** 発行入力から請求書を作る(番号採番 + 期日計算)。 */
export function issueInvoice(input: IssueInvoiceInput): Invoice {
  const number = formatInvoiceNumber(input.sequence, { date: new Date(input.issueDate) });
  const due = new Date(input.issueDate);
  due.setDate(due.getDate() + input.termDays);
  return buildInvoice(
    { number, issueDate: input.issueDate, dueDate: due.toISOString().slice(0, 10), billTo: input.billTo, registrationNumber: input.registrationNumber },
    input.lines,
  );
}

/** 請求書に入金状況を付けて返す(一覧表示用)。 */
export function invoiceWithStatus(invoice: Invoice, paidAmount: number, now: Date = new Date()) {
  return {
    ...invoice,
    paidAmount,
    status: paymentStatus({ issued: true, dueDate: invoice.dueDate, paidAmount, total: invoice.totals.total }, now),
  };
}

/** 見積の発行入力。 */
export interface IssueQuoteInput {
  number: string;
  issueDate: string;
  validUntil: string;
  billTo: string;
  lines: InvoiceLine[];
}

/** 見積を作る。 */
export function issueQuote(input: IssueQuoteInput): Quote {
  return buildQuote({ number: input.number, issueDate: input.issueDate, validUntil: input.validUntil, billTo: input.billTo }, input.lines);
}

/** 承認済み見積を請求書へ(採番 + 期日)。 */
export function acceptQuoteToInvoice(quote: Quote, sequence: number, issueDate: string, termDays: number): Invoice {
  const number = formatInvoiceNumber(sequence, { date: new Date(issueDate) });
  const due = new Date(issueDate);
  due.setDate(due.getDate() + termDays);
  return convertToInvoice(quote, { number, issueDate, dueDate: due.toISOString().slice(0, 10) });
}

export { quoteStatus };
