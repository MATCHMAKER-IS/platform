/** 経費の遷移 API(POST)。提出/承認をブループリントに沿って実行する。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { submitExpense, approveExpense, type ExpenseRecord } from "../../../../lib/expense-blueprint";

async function handlePOST(req: Request): Promise<Response> {
  // **`requirePermission` は検証済みの user を返す。** 戻り値を受ければ null チェックも
  // `user!` も不要になる(通らなければ例外で抜ける)
  const user = requirePermission(
    currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET),
    "expense:create",  // 提出・承認の操作。参照だけの権限では通さない
  );

  const body = (await req.json()) as { action: "submit" | "approve"; expense: ExpenseRecord };
  // **SessionPayload に `id` は無い。** 識別子は email(他の API も同じ)
  const actor = { id: user.email, roles: user.roles };

  const result = body.action === "submit" ? submitExpense(body.expense) : approveExpense(body.expense, actor);
  if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });
  return Response.json(result);
}

export const POST = withApiObservability("/api/expenses/transition", handlePOST);
