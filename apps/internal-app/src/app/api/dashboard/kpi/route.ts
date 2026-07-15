/** ダッシュボード: 経営 KPI(GET)。売掛・買掛・在庫・勤怠承認・請求を集約。dashboard:read。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { invoiceStore, purchaseStore, purchasePaymentStore, inventoryStore, attendanceApprovalStore } from "../../../../server/platform-services.js";
import { receivablesSummary, type ReceivableInvoice } from "../../../../server/receivables.js";
import { payablesSummary, type PayableOrder } from "../../../../server/payables-repo.js";
import { buildKpi, overdueFromAging } from "../../../../server/dashboard-kpi.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "dashboard:read");
  const now = new Date();

  const invoices = await invoiceStore.list();
  const rcvInput: ReceivableInvoice[] = invoices.map((i) => ({ number: i.number, billTo: i.billTo, dueDate: i.dueDate, total: i.totals.total, paidAmount: i.paidAmount, cancelled: i.cancelled }));
  const rcv = receivablesSummary(rcvInput, now);
  const overdueInvoices = invoices.filter((i) => i.status === "overdue").length;

  const orders = await purchaseStore.list();
  const paid = await purchasePaymentStore.paidByOrder();
  const payInput: PayableOrder[] = orders.map((o) => ({ number: o.number, supplier: o.order.supplier, orderDate: o.order.orderDate, ...(o.order.dueDate ? { dueDate: o.order.dueDate } : {}), total: o.order.totals.total, paidAmount: paid[o.number] ?? 0, cancelled: o.status === "cancelled" }));
  const pay = payablesSummary(payInput, now);

  const statuses = await inventoryStore.status();
  const reorderCount = statuses.filter((s) => s.needsReorder).length;
  const pendingApprovals = (await attendanceApprovalStore.listPending()).length;

  return Response.json(buildKpi({
    receivables: { outstanding: rcv.outstanding, overdue: overdueFromAging(rcv.aging) },
    payables: { outstanding: pay.outstanding, overdue: overdueFromAging(pay.aging) },
    reorderCount,
    pendingApprovals,
    overdueInvoices,
  }));
}

export const GET = withApiObservability("/api/dashboard/kpi", handleGET);
