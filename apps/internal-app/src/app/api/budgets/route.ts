/** 予算実績: 予算 vs 実績(経費)(GET)・予算行の追加(POST)。budget:read / budget:write。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { budgetStore, auditActions } from "../../../server/platform-services";
import { budgetVariance, actualsFromExpenses, type BudgetLine } from "../../../server/budget-repo";
import { listExpenses } from "../../../server/expense-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "budget:read");
  const period = new URL(req.url).searchParams.get("period") ?? new Date().toISOString().slice(0, 7);
  const budgets = await budgetStore.list(period);
  const expenses = (await listExpenses({ pageSize: 1000 })).items.map((e) => ({ date: e.date, category: e.category, amount: e.amount }));
  const actuals = actualsFromExpenses(expenses, period);
  return Response.json({ period, rows: budgetVariance(budgets, actuals) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "budget:write");
  const body = (await req.json()) as BudgetLine;
  if (!body.department || !body.category || !/^\d{4}-\d{2}$/.test(body.period ?? "") || !(body.amount > 0)) return Response.json({ error: "部門・区分・期間(YYYY-MM)・正の金額が必要です" }, { status: 400 });
  const saved = await budgetStore.add({ department: body.department, category: body.category, period: body.period, amount: body.amount });
  await auditActions.record(user!.email, "budget.add", `${body.category}:${body.period}`, { after: { amount: body.amount } });
  return Response.json(saved, { status: 201 });
}

export const GET = withApiObservability("/api/budgets", handleGET);
export const POST = withApiObservability("/api/budgets", handlePOST);
