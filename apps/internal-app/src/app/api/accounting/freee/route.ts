/** 会計: 仕訳を freee 形式へ変換(GET)。実送信はせずプレビューを返す。accounting:read。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { invoiceStore, purchaseStore } from "../../../../server/platform-services.js";
import { buildLedger, type LedgerInvoice, type LedgerPurchase } from "../../../../server/ledger.js";
import { freeeBatch, freeeBatchSummary } from "../../../../server/freee-export.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const invoices = await invoiceStore.list();
  const orders = await purchaseStore.list();
  const li: LedgerInvoice[] = invoices.map((i) => ({ number: i.number, issueDate: i.issueDate, subtotal: i.totals.subtotal, tax: i.totals.tax, paidAmount: i.paidAmount, cancelled: i.cancelled }));
  const lp: LedgerPurchase[] = orders.map((o) => ({ number: o.number, orderDate: o.order.orderDate, subtotal: o.order.totals.subtotal, tax: o.order.totals.tax, cancelled: o.status === "cancelled" }));
  const ledger = buildLedger({ invoices: li, purchases: lp });
  const batch = freeeBatch(ledger.entries);
  return Response.json({ ready: batch.ready, errors: batch.errors, summary: freeeBatchSummary(batch) });
}

export const GET = withApiObservability("/api/accounting/freee", handleGET);
