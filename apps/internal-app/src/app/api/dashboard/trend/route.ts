/** ダッシュボード: 売上/売掛の月次トレンド(GET ?months=6)。認証ユーザー。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { invoiceStore, purchaseStore } from "../../../../server/platform-services.js";
import { listExpenses } from "../../../../server/expense-repo.js";
import { recentMonths, salesTrend, spendTrend, summarizeSalesTrend } from "../../../../server/dashboard-trend.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  const now = new Date();
  const n = Math.min(Math.max(Number(new URL(req.url).searchParams.get("months") ?? "6"), 3), 12);
  const months = recentMonths(now, n);
  const [invoices, purchaseList, expenseList] = await Promise.all([invoiceStore.list(), purchaseStore.list(), listExpenses({ pageSize: 1000 })]);
  const points = salesTrend(invoices.map((i) => ({ issueDate: i.issueDate, total: i.totals?.total ?? 0, balance: i.balance ?? 0, cancelled: i.cancelled })), months);
  const spend = spendTrend(purchaseList.map((o) => ({ orderDate: o.order.orderDate, net: o.order.totals.subtotal, cancelled: o.status === "cancelled" })), expenseList.items.map((e) => ({ date: e.date, amount: e.amount })), months);
  const merged = points.map((p, i) => ({ ...p, purchases: spend[i]?.purchases ?? 0, expenses: spend[i]?.expenses ?? 0 }));
  return Response.json({ points: merged, summary: summarizeSalesTrend(points) });
}

export const GET = withApiObservability("/api/dashboard/trend", handleGET);
