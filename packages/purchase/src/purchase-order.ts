/**
 * 発注(購買。純ロジック)。発注明細・金額(税計算は @platform/invoice 再利用)・入荷/発注残・状態。
 * @packageDocumentation
 */
import { invoiceTotals, type InvoiceLine, type InvoiceTotals, type Rounding } from "@platform/invoice";

/** 発注明細(数量・単価・税率は invoice の明細と同形)。 */
export type PurchaseLine = InvoiceLine;

/** 発注書。 */
export interface PurchaseOrder {
  /** 発注番号。 */
  number: string;
  /** 発注日(ISO)。 */
  orderDate: string;
  /** 仕入先。 */
  supplier: string;
  /** 希望納期(ISO)。 */
  dueDate?: string;
  lines: PurchaseLine[];
  totals: InvoiceTotals;
  state?: "draft" | "ordered" | "cancelled";
}

/**
 * 発注の金額を計算する。
 *
 * **税計算は `@platform/invoice` に委譲**(端数処理の方針を一元管理するため)。
 *
 * @param lines 明細
 * @returns 小計・税額・合計
 */
export function purchaseTotals(lines: PurchaseLine[], rounding: Rounding = "floor"): InvoiceTotals {
  return invoiceTotals(lines, rounding);
}

/**
 * 発注書を組み立てる。
 *
 * @param header 発注先・日付など
 * @param lines 明細
 * @returns 発注書(金額は自動計算)
 */
export function buildPurchaseOrder(
  header: { number: string; orderDate: string; supplier: string; dueDate?: string; state?: PurchaseOrder["state"] },
  lines: PurchaseLine[],
  rounding: Rounding = "floor",
): PurchaseOrder {
  return { ...header, lines, totals: purchaseTotals(lines, rounding) };
}
