/** 会計: 請求・入金・仕入から仕訳と試算表を生成(GET)。accounting:read。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { invoiceStore, purchaseStore } from "../../../server/platform-services";
import { buildLedger, type LedgerInvoice, type LedgerPurchase } from "../../../server/ledger";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const invoices = await invoiceStore.list();
  const orders = await purchaseStore.list();
  const ledgerInvoices: LedgerInvoice[] = invoices.map((i) => ({ number: i.number, issueDate: i.issueDate, subtotal: i.totals.subtotal, tax: i.totals.tax, paidAmount: i.paidAmount, cancelled: i.cancelled }));
  const ledgerPurchases: LedgerPurchase[] = orders.map((o) => ({ number: o.number, orderDate: o.order.orderDate, subtotal: o.order.totals.subtotal, tax: o.order.totals.tax, cancelled: o.status === "cancelled" }));
  return Response.json(buildLedger({ invoices: ledgerInvoices, purchases: ledgerPurchases }));
}

export const GET = withApiObservability("/api/accounting", handleGET);
