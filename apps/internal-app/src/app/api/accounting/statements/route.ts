/** 会計: 月次決算(損益計算書・貸借対照表・消費税集計)(GET)。?month=YYYY-MM で対象月を絞る。accounting:read。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { invoiceStore, purchaseStore, assetStore, manualJournalStore, accountMasterStore } from "../../../../server/platform-services.js";
import { buildLedger, type LedgerInvoice, type LedgerPurchase } from "../../../../server/ledger.js";
import { financialStatements, aggregateRates, consumptionTax, type TaxByRate } from "../../../../server/financials.js";
import { depreciationJournal, DEPRECIATION_ACCOUNT_TYPES } from "../../../../server/depreciation-journal.js";
import { accountTypeMap } from "../../../../server/account-master-repo.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const month = new URL(req.url).searchParams.get("month");

  const invoices = (await invoiceStore.list()).filter((i) => !month || i.issueDate.startsWith(month));
  const orders = (await purchaseStore.list()).filter((o) => !month || o.order.orderDate.startsWith(month));

  const li: LedgerInvoice[] = invoices.map((i) => ({ number: i.number, issueDate: i.issueDate, subtotal: i.totals.subtotal, tax: i.totals.tax, paidAmount: i.paidAmount, cancelled: i.cancelled }));
  const lp: LedgerPurchase[] = orders.map((o) => ({ number: o.number, orderDate: o.order.orderDate, subtotal: o.order.totals.subtotal, tax: o.order.totals.tax, cancelled: o.status === "cancelled" }));
  const year = month ? Number(month.slice(0, 4)) : new Date().getFullYear();
  const depEntries = depreciationJournal(await assetStore.list(), year);
  const manualEntries = await manualJournalStore.entries(year);
  const ledger = buildLedger({ invoices: li, purchases: lp });
  const extraTypes = { ...DEPRECIATION_ACCOUNT_TYPES, ...accountTypeMap(await accountMasterStore.list()) };
  const statements = financialStatements([...ledger.entries, ...depEntries, ...manualEntries], extraTypes);

  const salesRates = aggregateRates(invoices.filter((i) => !i.cancelled).map((i) => i.totals.taxByRate as TaxByRate[]));
  const purchaseRates = aggregateRates(orders.filter((o) => o.status !== "cancelled").map((o) => o.order.totals.taxByRate as TaxByRate[]));
  const tax = consumptionTax(salesRates, purchaseRates);

  return Response.json({ month: month ?? null, profitAndLoss: statements.profitAndLoss, balanceSheet: statements.balanceSheet, consumptionTax: tax, depreciation: depEntries.reduce((s2, e) => s2 + e.lines[0]!.debit, 0), balanced: ledger.balanced });
}

export const GET = withApiObservability("/api/accounting/statements", handleGET);
