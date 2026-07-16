/** 買掛金: エイジングと支払予定(GET)。発注と支払記録から算出。purchase:read。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { purchaseStore, purchasePaymentStore } from "../../../server/platform-services";
import { payablesSummary, type PayableOrder } from "../../../server/payables-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "purchase:read");
  const orders = await purchaseStore.list();
  const paid = await purchasePaymentStore.paidByOrder();
  const input: PayableOrder[] = orders.map((o) => ({
    number: o.number,
    supplier: o.order.supplier,
    orderDate: o.order.orderDate,
    ...(o.order.dueDate ? { dueDate: o.order.dueDate } : {}),
    total: o.order.totals.total,
    paidAmount: paid[o.number] ?? 0,
    cancelled: o.status === "cancelled",
  }));
  return Response.json(payablesSummary(input));
}

export const GET = withApiObservability("/api/payables", handleGET);
