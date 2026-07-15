/** 会計: 勘定元帳(GET)。試算表からのドリルダウン用。?account=&year=。accounting:read。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { invoiceStore, purchaseStore, assetStore, manualJournalStore } from "../../../../server/platform-services.js";
import { buildLedger, type LedgerInvoice, type LedgerPurchase } from "../../../../server/ledger.js";
import { depreciationJournal } from "../../../../server/depreciation-journal.js";
import { accountLedger } from "../../../../server/account-ledger.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const params = new URL(req.url).searchParams;
  const account = params.get("account");
  if (!account) return Response.json({ error: "account を指定してください" }, { status: 400 });
  const year = Number(params.get("year") ?? new Date().getFullYear());
  const invoices = (await invoiceStore.list()).filter((i) => i.issueDate.startsWith(String(year)));
  const orders = (await purchaseStore.list()).filter((o) => o.order.orderDate.startsWith(String(year)));
  const li: LedgerInvoice[] = invoices.map((i) => ({ number: i.number, issueDate: i.issueDate, subtotal: i.totals.subtotal, tax: i.totals.tax, paidAmount: i.paidAmount, cancelled: i.cancelled }));
  const lp: LedgerPurchase[] = orders.map((o) => ({ number: o.number, orderDate: o.order.orderDate, subtotal: o.order.totals.subtotal, tax: o.order.totals.tax, cancelled: o.status === "cancelled" }));
  const entries = [...buildLedger({ invoices: li, purchases: lp }).entries, ...depreciationJournal(await assetStore.list(), year), ...(await manualJournalStore.entries(year))];
  return Response.json({ year, ledger: accountLedger(entries, account) });
}

export const GET = withApiObservability("/api/accounting/ledger", handleGET);
