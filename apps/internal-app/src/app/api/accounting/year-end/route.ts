/** 会計: 年次決算・繰越(GET)。当期の損益を繰越利益剰余金へ振り替える。?year=&priorRetained=。accounting:read。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { invoiceStore, purchaseStore, assetStore, manualJournalStore, accountMasterStore, settingsStore } from "../../../../server/platform-services";
import { buildLedger, type LedgerInvoice, type LedgerPurchase } from "../../../../server/ledger";
import { depreciationJournal, DEPRECIATION_ACCOUNT_TYPES } from "../../../../server/depreciation-journal";
import { yearEndClosing } from "../../../../server/year-end";
import { inFiscalYear } from "../../../../server/fiscal";
import { accountTypeMap } from "../../../../server/account-master-repo";
import { journalToRows } from "@platform/accounting";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const params = new URL(req.url).searchParams;
  const year = Number(params.get("year") ?? new Date().getFullYear());
  const closingMonth = (await settingsStore.get()).fiscalClosingMonth;
  const priorRetained = Number(params.get("priorRetained") ?? 0);

  const invoices = (await invoiceStore.list()).filter((i) => inFiscalYear(i.issueDate, year, closingMonth));
  const orders = (await purchaseStore.list()).filter((o) => inFiscalYear(o.order.orderDate, year, closingMonth));
  const li: LedgerInvoice[] = invoices.map((i) => ({ number: i.number, issueDate: i.issueDate, subtotal: i.totals.subtotal, tax: i.totals.tax, paidAmount: i.paidAmount, cancelled: i.cancelled }));
  const lp: LedgerPurchase[] = orders.map((o) => ({ number: o.number, orderDate: o.order.orderDate, subtotal: o.order.totals.subtotal, tax: o.order.totals.tax, cancelled: o.status === "cancelled" }));
  const depEntries = depreciationJournal(await assetStore.list(), year);
  const entries = [...buildLedger({ invoices: li, purchases: lp }).entries, ...depEntries, ...(await manualJournalStore.entries(year))];

  const extraTypes = { ...DEPRECIATION_ACCOUNT_TYPES, ...accountTypeMap(await accountMasterStore.list()) };
  const result = yearEndClosing(entries, year, priorRetained, extraTypes);
  return Response.json({ ...result, closingRows: journalToRows([result.closingEntry]) });
}

export const GET = withApiObservability("/api/accounting/year-end", handleGET);
