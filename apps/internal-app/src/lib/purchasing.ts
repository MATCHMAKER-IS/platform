/**
 * 発注・入荷・在庫のアプリ層サービス(基盤 @platform/purchase・@platform/inventory の合成)。
 * @packageDocumentation
 */
import { buildPurchaseOrder, receivingStatus, purchaseStatus, type PurchaseLine, type PurchaseOrder, type Receipt } from "@platform/purchase";
import { onHand, needsReorder, reorderQuantity, type StockMovement, type ReorderPolicy } from "@platform/inventory";

/** 発注書を作る。 */
export function createPurchaseOrder(input: { number: string; orderDate: string; supplier: string; dueDate?: string; lines: PurchaseLine[] }): PurchaseOrder {
  return buildPurchaseOrder({ number: input.number, orderDate: input.orderDate, supplier: input.supplier, dueDate: input.dueDate, state: "ordered" }, input.lines);
}

/** 発注に入荷を突き合わせ、状態と発注残を返す（一覧表示用）。 */
export function purchaseProgress(order: PurchaseOrder, receipts: Receipt[]) {
  return {
    status: purchaseStatus(order, receipts),
    lines: receivingStatus(order.lines, receipts),
  };
}

/** 入荷を在庫の入庫として記録する（発注番号を参照に）。 */
export function receiptToMovement(order: PurchaseOrder, receipt: Receipt): StockMovement {
  const line = order.lines[receipt.lineIndex];
  return { type: "inbound", quantity: receipt.quantity, at: receipt.receivedAt, ref: order.number, unitCost: line?.unitPrice };
}

/** 現在庫と補充要否を判定する。 */
export function stockStatus(movements: StockMovement[], policy: ReorderPolicy) {
  const qty = onHand(movements);
  return { onHand: qty, needsReorder: needsReorder(qty, policy), suggestedQuantity: reorderQuantity(qty, policy) };
}
