/** 経費の遷移 API(POST)。提出/承認をブループリントに沿って実行する。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { submitExpense, approveExpense, type ExpenseRecord } from "../../../../lib/expense-blueprint";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "expense:create");  // 提出・承認の操作。参照だけの権限では通さない

  const body = (await req.json()) as { action: "submit" | "approve"; expense: ExpenseRecord };
  const actor = { id: user.id, roles: user.roles };

  const result = body.action === "submit" ? submitExpense(body.expense) : approveExpense(body.expense, actor);
  if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });
  return Response.json(result);
}

export const POST = withApiObservability("/api/expenses/transition", handlePOST);
