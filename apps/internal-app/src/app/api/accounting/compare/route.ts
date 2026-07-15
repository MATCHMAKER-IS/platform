/** 会計: 複数年度の比較決算(GET)。当期と前期の損益・貸借を並べ増減を出す。?year=。accounting:read。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { invoiceStore, purchaseStore, assetStore, manualJournalStore, accountMasterStore, settingsStore } from "../../../../server/platform-services.js";
import { buildLedger, type LedgerInvoice, type LedgerPurchase } from "../../../../server/ledger.js";
import { depreciationJournal, DEPRECIATION_ACCOUNT_TYPES } from "../../../../server/depreciation-journal.js";
import { accountTypeMap } from "../../../../server/account-master-repo.js";
import { financialStatements } from "../../../../server/financials.js";
import { compareStatements } from "../../../../server/comparative.js";
import { inFiscalYear } from "../../../../server/fiscal.js";

async function statementsForYear(year: number, closingMonth: number) {
  const invoices = (await invoiceStore.list()).filter((i) => inFiscalYear(i.issueDate, year, closingMonth));
  const orders = (await purchaseStore.list()).filter((o) => inFiscalYear(o.order.orderDate, year, closingMonth));
  const li: LedgerInvoice[] = invoices.map((i) => ({ number: i.number, issueDate: i.issueDate, subtotal: i.totals.subtotal, tax: i.totals.tax, paidAmount: i.paidAmount, cancelled: i.cancelled }));
  const lp: LedgerPurchase[] = orders.map((o) => ({ number: o.number, orderDate: o.order.orderDate, subtotal: o.order.totals.subtotal, tax: o.order.totals.tax, cancelled: o.status === "cancelled" }));
  const entries = [...buildLedger({ invoices: li, purchases: lp }).entries, ...depreciationJournal(await assetStore.list(), year), ...(await manualJournalStore.entries(year))];
  const extraTypes = { ...DEPRECIATION_ACCOUNT_TYPES, ...accountTypeMap(await accountMasterStore.list()) };
  return financialStatements(entries, extraTypes);
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const year = Number(new URL(req.url).searchParams.get("year") ?? new Date().getFullYear());
  const closingMonth = (await settingsStore.get()).fiscalClosingMonth;
  const [current, prior] = await Promise.all([statementsForYear(year, closingMonth), statementsForYear(year - 1, closingMonth)]);
  return Response.json({ comparison: compareStatements(year, year - 1, current, prior) });
}

export const GET = withApiObservability("/api/accounting/compare", handleGET);
