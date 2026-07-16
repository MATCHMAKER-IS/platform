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

/**
 * 見積の合計を計算する。
 *
 * **税計算は `@platform/invoice` に委譲**(請求書と同じ計算にする)。
 *
 * @param lines 明細
 * @returns 小計・税額・合計
 */
export function quoteTotals(lines: InvoiceLine[], rounding: Rounding = "floor"): InvoiceTotals {
  return invoiceTotals(lines, rounding);
}

/**
 * 見積を組み立てる。
 *
 * @param header 取引先・日付・有効期限など
 * @param lines 明細
 * @returns 見積(金額は自動計算)
 */
export function buildQuote(
  header: { number: string; issueDate: string; validUntil: string; billTo: string; state?: Quote["state"] },
  lines: InvoiceLine[],
  rounding: Rounding = "floor",
): Quote {
  return { ...header, lines, totals: quoteTotals(lines, rounding) };
}

/**
 * 有効期限切れかを判定する。
 *
 * @param quote 見積
 * @param now 基準日(テスト注入用)
 * @returns 期限を過ぎていれば true。**期限が無ければ false**
 */
export function isExpired(quote: Pick<Quote, "validUntil">, now: Date = new Date()): boolean {
  const until = new Date(quote.validUntil);
  const untilDay = new Date(until.getFullYear(), until.getMonth(), until.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return today > untilDay;
}

/**
 * 見積の表示状態を判定する。
 *
 * **明示的な状態を優先**(承認済み・却下は、期限が過ぎても期限切れとは表示しない。
 * 「承認したのに期限切れ」では意味が通らない)。
 *
 * @param quote 見積
 * @param now 基準日(テスト注入用)
 * @returns 表示する状態
 */
export function quoteStatus(quote: Pick<Quote, "validUntil" | "state">, now: Date = new Date()): QuoteStatus {
  if (quote.state === "accepted") return "accepted";
  if (quote.state === "rejected") return "rejected";
  if (isExpired(quote, now)) return "expired";
  return quote.state === "sent" ? "sent" : "draft";
}

/**
 * 有効期限までの日数を返す。
 *
 * @param quote 見積
 * @param now 基準日(テスト注入用)
 * @returns 残り日数(**過ぎていれば負**)。期限が無ければ undefined
 */
export function daysUntilExpiry(quote: Pick<Quote, "validUntil">, now: Date = new Date()): number {
  const until = new Date(quote.validUntil);
  const a = new Date(until.getFullYear(), until.getMonth(), until.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/**
 * 承認された見積を請求書に変換する。
 *
 * **明細をそのまま引き継ぐ**ので、転記ミスが起きない(手で作り直すと必ずどこかで間違える)。
 *
 * @param quote 見積
 * @param input 請求書番号・支払期日
 * @returns 請求書
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — **承認されていない見積**を変換しようとした場合
 */
export function convertToInvoice(
  quote: Quote,
  header: { number: string; issueDate: string; dueDate: string; registrationNumber?: string },
  rounding: Rounding = "floor",
): Invoice {
  return buildInvoice({ ...header, billTo: quote.billTo }, quote.lines, rounding);
}
