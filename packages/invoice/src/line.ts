/**
 * 請求明細と金額計算(純ロジック)。
 * 数量×単価、明細ごとの割引を計算する。消費税は行では計算せず、税率区分ごとに集計する(適格請求書要件)。
 * @packageDocumentation
 */
import { type TaxRate } from "@platform/tax";

/** 請求明細(1 行)。 */
export interface InvoiceLine {
  /** 品目・摘要。 */
  description: string;
  /** 数量。 */
  quantity: number;
  /** 単価(税抜)。 */
  unitPrice: number;
  /** 税率(10 / 8 / 0)。既定 10。 */
  taxRate?: TaxRate;
  /** 明細割引(金額。税抜)。 */
  discount?: number;
  /** 軽減税率対象の目印(表示用)。 */
  reducedRate?: boolean;
}

/** 明細の税抜金額(数量×単価 − 割引、0 未満にはしない)。 */
export function lineNet(line: InvoiceLine): number {
  const gross = line.quantity * line.unitPrice - (line.discount ?? 0);
  return Math.max(0, Math.round(gross));
}

/** 明細の税率(未指定は 10）。 */
export function lineTaxRate(line: InvoiceLine): TaxRate {
  return line.taxRate ?? 10;
}
