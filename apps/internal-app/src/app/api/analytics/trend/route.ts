/** 経営分析: 月次推移(売上・仕入・経費・粗利)(GET)。?from=YYYY-MM&to=YYYY-MM。dashboard:read。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { invoiceStore, purchaseStore } from "../../../../server/platform-services";
import { listExpenses } from "../../../../server/expense-repo";
import { monthlyTrend, monthRange, summarizeTrend, type TrendInvoice, type TrendPurchase, type TrendExpense } from "../../../../server/trend";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - 5, 1);
  return { from: from.toISOString().slice(0, 7), to: to.toISOString().slice(0, 7) };
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "dashboard:read");
  const params = new URL(req.url).searchParams;
  const def = defaultRange();
  const from = params.get("from") ?? def.from;
  const to = params.get("to") ?? def.to;
  const months = monthRange(from, to);

  const invoices: TrendInvoice[] = (await invoiceStore.list()).map((i) => ({ issueDate: i.issueDate, net: i.totals.subtotal, cancelled: i.cancelled }));
  const purchases: TrendPurchase[] = (await purchaseStore.list()).map((o) => ({ orderDate: o.order.orderDate, net: o.order.totals.subtotal, cancelled: o.status === "cancelled" }));
  const expenses: TrendExpense[] = (await listExpenses({ pageSize: 1000 })).items.map((e) => ({ date: e.date, amount: e.amount }));

  const points = monthlyTrend(invoices, purchases, expenses, months);
  return Response.json({ from, to, points, summary: summarizeTrend(points) });
}

export const GET = withApiObservability("/api/analytics/trend", handleGET);
