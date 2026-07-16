/** 取引先: 債権債務残高の一覧(GET)。売掛(未回収請求)と買掛(未払発注)を名寄せ。partner:read。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { partnerStore, invoiceStore, purchaseStore, purchasePaymentStore } from "../../../../server/platform-services";
import { partnerBalances, totalBalances, type BalanceInvoice, type BalanceOrder } from "../../../../server/partner-balance";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "partner:read");
  const partners = (await partnerStore.list()).map((p) => ({ code: p.code, name: p.name }));
  const invoices: BalanceInvoice[] = (await invoiceStore.list()).filter((i) => !i.cancelled).map((i) => ({ billTo: i.billTo, balance: i.balance }));
  const paid = await purchasePaymentStore.paidByOrder();
  const orders: BalanceOrder[] = (await purchaseStore.list()).filter((o) => o.status !== "cancelled").map((o) => ({ supplier: o.order.supplier, balance: o.order.totals.total - (paid[o.number] ?? 0) }));
  const balances = partnerBalances(partners, invoices, orders);
  return Response.json({ balances, total: totalBalances(balances) });
}

export const GET = withApiObservability("/api/partners/balances", handleGET);
