/** 経営分析: 月次推移(売上・仕入・経費・粗利)(GET)。?from=YYYY-MM&to=YYYY-MM。dashboard:read。 */
import { withApiObservability } from "../../../../server/instrument";
import { formatDateJst } from "@platform/datetime";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { invoiceStore, purchaseStore } from "../../../../server/platform-services";
import { listExpenses } from "../../../../server/expense-repo";
import { monthlyTrend, monthRange, summarizeTrend, type TrendInvoice, type TrendPurchase, type TrendExpense } from "../../../../server/trend";

function defaultRange(): { from: string; to: string } {
  // **JST の「今日」から数える。**
  // `new Date()` はサーバのタイムゾーン（コンテナは UTC）なので、
  // **JST の月初 0 時〜9 時は、UTC ではまだ前月**——
  // **「直近 6 か月」が 1 か月ずれます**（`api/cashflow` と同じ形でした）。
  // **`todayJst()` は `Date` を返す。** 文字列が要るのは `formatDateJst()`
  // ——`.slice()` を呼んでいたため、**この行から先が実行時に落ちていた**。
  const today = formatDateJst();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const fromMonth = month - 5;
  const fromYear = fromMonth <= 0 ? year - 1 : year;
  const normalized = fromMonth <= 0 ? fromMonth + 12 : fromMonth;
  return { from: `${String(fromYear)}-${String(normalized).padStart(2, "0")}`, to: today.slice(0, 7) };
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
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
