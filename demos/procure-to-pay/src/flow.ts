/**
 * 商流統合オーケストレーション(見積 → 発注 → 入荷 → 在庫 → 請求)。
 * 各ステップは基盤パッケージのロジックを合成するだけ。UI ではなくワークフローの結線例。
 * @packageDocumentation
 */
import { buildQuote, quoteStatus, convertToInvoice, type Quote } from "@platform/quote";
import { buildPurchaseOrder, receivingStatus, purchaseStatus, type PurchaseOrder, type Receipt } from "@platform/purchase";
import { onHand, movingAverage, needsReorder, reorderQuantity, type StockMovement, type ReorderPolicy } from "@platform/inventory";
import { paymentStatus, type Invoice, type InvoiceLine } from "@platform/invoice";

/** 1. 見積を作成する。 */
export function step1_quote(billTo: string, lines: InvoiceLine[]): Quote {
  return buildQuote({ number: "QUO-0001", issueDate: "2025-07-01", validUntil: "2025-07-31", billTo }, lines);
}

/** 2. 承認された見積を発注に変換する(仕入先向け発注書）。 */
export function step2_purchaseOrder(supplier: string, lines: InvoiceLine[]): PurchaseOrder {
  return buildPurchaseOrder({ number: "PO-0001", orderDate: "2025-07-02", supplier, state: "ordered" }, lines);
}

/** 3. 入荷を記録し、発注残と状態を返す。 */
export function step3_receive(order: PurchaseOrder, receipts: Receipt[]) {
  return { status: purchaseStatus(order, receipts), lines: receivingStatus(order.lines, receipts) };
}

/** 4. 入荷を在庫の入庫に反映し、在庫評価と補充要否を返す。 */
export function step4_stock(order: PurchaseOrder, receipts: Receipt[], policy: ReorderPolicy) {
  const movements: StockMovement[] = receipts.map((r) => ({ type: "inbound", quantity: r.quantity, at: r.receivedAt, ref: order.number, unitCost: order.lines[r.lineIndex]?.unitPrice }));
  const qty = onHand(movements);
  return { movements, onHand: qty, valuation: movingAverage(movements), needsReorder: needsReorder(qty, policy), suggested: reorderQuantity(qty, policy) };
}

/** 5. 承認済み見積から顧客向け請求書を発行し、入金状態を付ける。 */
export function step5_invoice(quote: Quote): { invoice: Invoice; status: string } {
  const invoice = convertToInvoice(quote, { number: "INV-202507-0001", issueDate: "2025-07-16", dueDate: "2025-08-31" });
  return { invoice, status: paymentStatus({ issued: true, dueDate: invoice.dueDate, paidAmount: 0, total: invoice.totals.total }) };
}

/** 見積の状態を確認する（承認判定用）。 */
export { quoteStatus };
