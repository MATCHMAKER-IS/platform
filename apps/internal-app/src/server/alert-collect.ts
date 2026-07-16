/**
 * 運用アラートの入力収集。売掛・買掛・在庫・勤怠承認・請求の現況を集めて AlertInput を作る。
 * @packageDocumentation
 */
import { invoiceStore, purchaseStore, purchasePaymentStore, inventoryStore, attendanceApprovalStore } from "./platform-services";
import { receivablesSummary, type ReceivableInvoice } from "./receivables";
import { payablesSummary, type PayableOrder } from "./payables-repo";
import { overdueFromAging } from "./dashboard-kpi";
import { type AlertInput } from "./alerts";

/** 各ストアから現況を集めてアラート入力を作る。 */
export async function collectAlertInput(): Promise<AlertInput> {
  const now = new Date();
  const invoices = await invoiceStore.list();
  const rcv = receivablesSummary(invoices.map((i): ReceivableInvoice => ({ number: i.number, billTo: i.billTo, dueDate: i.dueDate, total: i.totals.total, paidAmount: i.paidAmount, cancelled: i.cancelled })), now);
  const orders = await purchaseStore.list();
  const paid = await purchasePaymentStore.paidByOrder();
  const pay = payablesSummary(orders.map((o): PayableOrder => ({ number: o.number, supplier: o.order.supplier, orderDate: o.order.orderDate, ...(o.order.dueDate ? { dueDate: o.order.dueDate } : {}), total: o.order.totals.total, paidAmount: paid[o.number] ?? 0, cancelled: o.status === "cancelled" })), now);
  const statuses = await inventoryStore.status();
  return {
    receivablesOverdue: overdueFromAging(rcv.aging),
    payablesOverdue: overdueFromAging(pay.aging),
    overdueInvoices: invoices.filter((i) => i.status === "overdue").length,
    pendingApprovals: (await attendanceApprovalStore.listPending()).length,
    reorderCount: statuses.filter((s) => s.needsReorder).length,
  };
}
