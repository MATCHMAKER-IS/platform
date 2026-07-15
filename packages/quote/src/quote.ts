/**
 * 見積(純ロジック)。明細計算は @platform/invoice を再利用し、見積特有の有効期限・状態・請求書変換を持つ。
 * @packageDocumentation
 */
import { invoiceTotals, type InvoiceLine, type InvoiceTotals, type Invoice, buildInvoice, type Rounding } from "@platform/invoice";

/** 見積の状態。 */
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

/** 見積書。 */
export interface Quote {
  /** 見積番号(自社採番)。 */
  number: string;
  /** 発行日(ISO)。 */
  issueDate: string;
  /** 有効期限(ISO)。 */
  validUntil: string;
  /** 宛先。 */
  billTo: string;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  /** 記録上の状態(accepted/rejected は明示操作)。 */
  state?: "draft" | "sent" | "accepted" | "rejected";
}

/** 明細から見積の合計を計算する(税計算は invoice に委譲)。 */
export function quoteTotals(lines: InvoiceLine[], rounding: Rounding = "floor"): InvoiceTotals {
  return invoiceTotals(lines, rounding);
}

/** 見積を組み立てる。 */
export function buildQuote(
  header: { number: string; issueDate: string; validUntil: string; billTo: string; state?: Quote["state"] },
  lines: InvoiceLine[],
  rounding: Rounding = "floor",
): Quote {
  return { ...header, lines, totals: quoteTotals(lines, rounding) };
}

/** 有効期限切れか。 */
export function isExpired(quote: Pick<Quote, "validUntil">, now: Date = new Date()): boolean {
  const until = new Date(quote.validUntil);
  const untilDay = new Date(until.getFullYear(), until.getMonth(), until.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return today > untilDay;
}

/** 見積の表示状態を判定する(明示状態 > 期限切れ)。 */
export function quoteStatus(quote: Pick<Quote, "validUntil" | "state">, now: Date = new Date()): QuoteStatus {
  if (quote.state === "accepted") return "accepted";
  if (quote.state === "rejected") return "rejected";
  if (isExpired(quote, now)) return "expired";
  return quote.state === "sent" ? "sent" : "draft";
}

/** 有効期限までの日数(過ぎていれば負)。 */
export function daysUntilExpiry(quote: Pick<Quote, "validUntil">, now: Date = new Date()): number {
  const until = new Date(quote.validUntil);
  const a = new Date(until.getFullYear(), until.getMonth(), until.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/** 承認された見積を請求書に変換する(明細を引き継ぎ、請求書番号・期日を付与)。 */
export function convertToInvoice(
  quote: Quote,
  header: { number: string; issueDate: string; dueDate: string; registrationNumber?: string },
  rounding: Rounding = "floor",
): Invoice {
  return buildInvoice({ ...header, billTo: quote.billTo }, quote.lines, rounding);
}
