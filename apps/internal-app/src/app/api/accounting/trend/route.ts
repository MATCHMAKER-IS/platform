/** 会計: 年次推移(GET)。直近 N 年度の損益を並べ前年比を付ける。?years=（既定3）。accounting:read。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { invoiceStore, purchaseStore, assetStore, manualJournalStore, accountMasterStore } from "../../../../server/platform-services.js";
import { buildLedger, type LedgerInvoice, type LedgerPurchase } from "../../../../server/ledger.js";
import { depreciationJournal, DEPRECIATION_ACCOUNT_TYPES } from "../../../../server/depreciation-journal.js";
import { financialStatements } from "../../../../server/financials.js";
import { accountTypeMap } from "../../../../server/account-master-repo.js";
import { yearlyTrend, trendRange, trendTotals, type YearPnl } from "../../../../server/yearly-trend.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const params = new URL(req.url).searchParams;
  const years = Math.min(10, Math.max(2, Number(params.get("years") ?? 3)));
  const endYear = Number(params.get("year") ?? new Date().getFullYear());
  const extraTypes = { ...DEPRECIATION_ACCOUNT_TYPES, ...accountTypeMap(await accountMasterStore.list()) };
  const allInvoices = await invoiceStore.list();
  const allOrders = await purchaseStore.list();
  const allAssets = await assetStore.list();
  const points: YearPnl[] = [];
  for (let y = endYear - years + 1; y <= endYear; y++) {
    const li: LedgerInvoice[] = allInvoices.filter((i) => i.issueDate.startsWith(String(y))).map((i) => ({ number: i.number, issueDate: i.issueDate, subtotal: i.totals.subtotal, tax: i.totals.tax, paidAmount: i.paidAmount, cancelled: i.cancelled }));
    const lp: LedgerPurchase[] = allOrders.filter((o) => o.order.orderDate.startsWith(String(y))).map((o) => ({ number: o.number, orderDate: o.order.orderDate, subtotal: o.order.totals.subtotal, tax: o.order.totals.tax, cancelled: o.status === "cancelled" }));
    const entries = [...buildLedger({ invoices: li, purchases: lp }).entries, ...depreciationJournal(allAssets, y), ...(await manualJournalStore.entries(y))];
    const st = financialStatements(entries, extraTypes);
    points.push({ year: y, revenue: st.profitAndLoss.revenue, expense: st.profitAndLoss.expense, netIncome: st.profitAndLoss.netIncome });
  }
  return Response.json({ trend: yearlyTrend(points), range: trendRange(points), totals: trendTotals(points) });
}

export const GET = withApiObservability("/api/accounting/trend", handleGET);
