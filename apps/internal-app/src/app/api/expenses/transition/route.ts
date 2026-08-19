/** 経費の遷移 API(POST)。提出/承認をブループリントに沿って実行する。 */
import { withApiObservability } from "../../../../server/instrument";
// **二重送信を防ぐ。** 状態遷移は連打で二重に走ると、
// **承認が 2 回記録される**——監査ログから経緯を追えなくなる。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../server/idempotency";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { submitExpense, approveExpense, type ExpenseRecord } from "../../../../lib/expense-blueprint";
import { validate, z } from "@platform/validation";

/**
 * 経費レコードの最小限の形。
 *
 * **`amount` は数値であることを保証する。** これまで `as ExpenseRecord` の
 * キャストのみで、実行時には何も確かめていなかった——`amount` が文字列や
 * `undefined` だと `routeByAmount` の比較(`amount < 30000` 等)が壊れ、
 * **意図しない承認段数のルートに落ちる**(承認をすり抜ける方向にも、
 * 過剰に承認者を要求する方向にも振れうる)。金額を扱う経路なので、
 * 形の検証を先に行う。
 *
 * **それ以外のフィールドは通す。** `ExpenseRecord` は `Record<string, unknown>`
 * を継承しており、`applyTransition` 側で状態遷移そのものを検証する設計
 * ——ここで全項目を厳密化すると二重管理になる。
 */
const ExpenseInput = z.object({ amount: z.number() }).passthrough();

async function handlePOST(req: Request): Promise<Response> {
  // **`requirePermission` は検証済みの user を返す。** 戻り値を受ければ null チェックも
  // `user!` も不要になる(通らなければ例外で抜ける)
  const session = currentUser(req);
  // **キーが無ければ素通し。** 付けるのは呼び出し側の責任。
  return withIdempotency(req, { store: idempotencyStore, scope: session!.email }, () => run(req, session!));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(req: Request, session: NonNullable<ReturnType<typeof currentUser>>): Promise<Response> {

  const body = (await req.json().catch(() => ({}))) as { action?: unknown; expense?: unknown };

  // **操作の種類を先に確かめる。**
  // 以前は `body.action === "submit" ? … : approve` と書いており、
  // **知らない値がすべて承認に落ちていた**(`action: "x"` で承認できた)
  const action = body.action;
  if (action !== "submit" && action !== "approve") {
    return Response.json({ error: "action は submit か approve です" }, { status: 400 });
  }

  // **提出と承認で必要な権限が違う。**
  // 以前はどちらも `expense:create` で、**申請した本人が自分で承認できた**。
  // 承認は「別の人が確かめる」ことに意味があるので、権限を分ける
  const user = requirePermission(
    session,
    action === "submit" ? "expense:create" : "expense:approve:own",
  );

  // **SessionPayload に `id` は無い。** 識別子は email(他の API も同じ)
  const actor = { id: user.email, roles: user.roles };

  const expenseParsed = validate(ExpenseInput, body.expense);
  if (!expenseParsed.ok) {
    return Response.json({ error: expenseParsed.error.message, details: expenseParsed.error.details }, { status: 400 });
  }
  const expense = expenseParsed.value as ExpenseRecord;
  const result = action === "submit" ? submitExpense(expense) : approveExpense(expense, actor);
  if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });
  return Response.json(result);
}

export const POST = withApiObservability("/api/expenses/transition", handlePOST);
