/**
 * 請求書の組み立てと集計(純ロジック)。
 * 明細を税率区分ごとに集計し(適格請求書の要件)、小計・消費税・合計を出す。税計算は @platform/tax。
 * @packageDocumentation
 */
import { summarizeTax, type Rounding, type TaxSummary, type TaxLine } from "@platform/tax";
import { type InvoiceLine, lineNet, lineTaxRate } from "./line.js";

/** 請求書の集計結果。 */
export interface InvoiceTotals {
  /** 小計(税抜合計)。 */
  subtotal: number;
  /** 消費税(税率区分ごとに 1 回丸めた合計)。 */
  tax: number;
  /** 合計(税込)。 */
  total: number;
  /** 税率別の内訳(適格請求書に必須)。 */
  taxByRate: TaxSummary["byRate"];
}

/**
 * 明細群から請求書の合計を計算する。
 *
 *
 * @param lines 明細
 * @param options.rounding 端数処理(既定 floor)
 * @returns 小計・税額・合計と、**税率別の内訳**(適格請求書に必要な区分記載)
 */
export function invoiceTotals(lines: InvoiceLine[], rounding: Rounding = "floor"): InvoiceTotals {
  const taxLines: TaxLine[] = lines.map((l) => ({ net: lineNet(l), rate: lineTaxRate(l) }));
  const summary = summarizeTax(taxLines, rounding);
  return { subtotal: summary.net, tax: summary.tax, total: summary.gross, taxByRate: summary.byRate };
}

/** 請求書ヘッダ情報。 */
export interface InvoiceHeader {
  /** 請求書番号(自社採番)。 */
  number: string;
  /** 発行日(ISO)。 */
  issueDate: string;
  /** 支払期限(ISO)。 */
  dueDate: string;
  /** 適格請求書発行事業者の登録番号(T+13桁)。 */
  registrationNumber?: string;
  /** 宛先。 */
  billTo: string;
}

/** 請求書全体。 */
export interface Invoice extends InvoiceHeader {
  lines: InvoiceLine[];
  totals: InvoiceTotals;
}

/**
 * ヘッダ + 明細から請求書を組み立てる(合計を計算して埋める)。
 *
 *
 * @param header 取引先・日付・請求書番号など
 * @param lines 明細
 * @returns 請求書(**合計は自動計算**)
 */
export function buildInvoice(header: InvoiceHeader, lines: InvoiceLine[], rounding: Rounding = "floor"): Invoice {
  return { ...header, lines, totals: invoiceTotals(lines, rounding) };
}
