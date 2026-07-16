/** 取引先: 活動集約（請求・発注・報酬の名寄せ）(GET)。partner:read。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { partnerStore, invoiceStore, purchaseStore, feePaymentStore } from "../../../../../server/platform-services";
import { partnerActivity, type LinkInvoice, type LinkOrder, type LinkFeePayment } from "../../../../../server/partner-link";

async function handleGET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "partner:read");
  const partner = await partnerStore.get(code);
  if (!partner) return Response.json({ error: "取引先が見つかりません" }, { status: 404 });

  const invoices: LinkInvoice[] = (await invoiceStore.list()).map((i) => ({ number: i.number, issueDate: i.issueDate, billTo: i.billTo, total: i.totals.total }));
  const orders: LinkOrder[] = (await purchaseStore.list()).map((o) => ({ number: o.number, orderDate: o.order.orderDate, supplier: o.order.supplier, total: o.order.totals.total }));
  const fees: LinkFeePayment[] = (await feePaymentStore.list()).map((f) => ({ payee: f.payee, category: f.category, base: f.base, withholding: f.withholding, paidAt: f.paidAt }));

  return Response.json({ partner, activity: partnerActivity(partner.name, invoices, orders, fees) });
}

export const GET = withApiObservability("/api/partners/[code]/activity", handleGET);
