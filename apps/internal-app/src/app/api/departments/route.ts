/** 部門別会計: 部門ごとの予算実績(GET)。予算(部門×区分)と経費を突き合わせる。?period=YYYY-MM。accounting:read。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { budgetStore } from "../../../server/platform-services.js";
import { listExpenses } from "../../../server/expense-repo.js";
import { departmentBudgetVsActual } from "../../../server/department.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "accounting:read");
  const period = new URL(req.url).searchParams.get("period") ?? new Date().toISOString().slice(0, 7);
  const budgets = (await budgetStore.list(period)).map((b) => ({ department: b.department, category: b.category, amount: b.amount }));
  const expenses = (await listExpenses({ pageSize: 1000 })).items.filter((e) => e.date.slice(0, 7) === period).map((e) => ({ category: e.category, amount: e.amount }));
  return Response.json({ period, departments: departmentBudgetVsActual(budgets, expenses) });
}

export const GET = withApiObservability("/api/departments", handleGET);
