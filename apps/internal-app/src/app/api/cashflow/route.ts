/** 資金繰り: 営業キャッシュフローの月次(GET)。入金(収入)と支払・経費・報酬(支出)から算出。?from=&to=&opening=。accounting:read。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { receiptStore, purchasePaymentStore, feePaymentStore } from "../../../server/platform-services.js";
import { listExpenses } from "../../../server/expense-repo.js";
import { monthlyCashFlow, summarizeCashFlow, type CashMovement } from "../../../server/cashflow.js";
import { monthRange } from "../../../server/trend.js";

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - 5, 1);
  return { from: from.toISOString().slice(0, 7), to: to.toISOString().slice(0, 7) };
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const params = new URL(req.url).searchParams;
  const def = defaultRange();
  const from = params.get("from") ?? def.from;
  const to = params.get("to") ?? def.to;
  const opening = Number(params.get("opening") ?? 0);
  const months = monthRange(from, to);

  const inflows: CashMovement[] = (await receiptStore.list()).map((r) => ({ date: r.receivedAt, amount: r.amount }));
  const purchasePays: CashMovement[] = (await purchasePaymentStore.list()).map((p) => ({ date: p.paidAt, amount: p.amount }));
  const feePays: CashMovement[] = (await feePaymentStore.list()).map((f) => ({ date: f.paidAt, amount: f.net }));
  const expensePays: CashMovement[] = (await listExpenses({ pageSize: 1000 })).items.map((e) => ({ date: e.date, amount: e.amount }));
  const outflows: CashMovement[] = [...purchasePays, ...feePays, ...expensePays];

  const rows = monthlyCashFlow(inflows, outflows, months, opening);
  return Response.json({ from, to, opening, rows, summary: summarizeCashFlow(rows, opening) });
}

export const GET = withApiObservability("/api/cashflow", handleGET);
