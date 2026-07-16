/** 会計: 仕訳帳CSVエクスポート(GET)。当期の全仕訳を会計ソフト取込用CSVで返す。?year=。accounting:read。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { invoiceStore, purchaseStore, assetStore, manualJournalStore } from "../../../../server/platform-services";
import { buildLedger, type LedgerInvoice, type LedgerPurchase } from "../../../../server/ledger";
import { depreciationJournal } from "../../../../server/depreciation-journal";
import { journalCsv } from "../../../../server/journal-export";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const year = Number(new URL(req.url).searchParams.get("year") ?? new Date().getFullYear());
  const invoices = (await invoiceStore.list()).filter((i) => i.issueDate.startsWith(String(year)));
  const orders = (await purchaseStore.list()).filter((o) => o.order.orderDate.startsWith(String(year)));
  const li: LedgerInvoice[] = invoices.map((i) => ({ number: i.number, issueDate: i.issueDate, subtotal: i.totals.subtotal, tax: i.totals.tax, paidAmount: i.paidAmount, cancelled: i.cancelled }));
  const lp: LedgerPurchase[] = orders.map((o) => ({ number: o.number, orderDate: o.order.orderDate, subtotal: o.order.totals.subtotal, tax: o.order.totals.tax, cancelled: o.status === "cancelled" }));
  const entries = [...buildLedger({ invoices: li, purchases: lp }).entries, ...depreciationJournal(await assetStore.list(), year), ...(await manualJournalStore.entries(year))];
  const csv = journalCsv(entries);
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="journal-${year}.csv"` } });
}

export const GET = withApiObservability("/api/accounting/export", handleGET);
