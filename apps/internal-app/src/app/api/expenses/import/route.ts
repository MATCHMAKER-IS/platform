/** 経費取込 API(POST)。取込行を Expense に変換し、バッチ記録+監査つきで一括作成する。 */
import { currentUser, requirePermission } from "../../../../server/authorize";
// **二重送信を防ぐ。** 経費の取り込みは連打・再送で二重に走ると、
// 同じ経費が二重に登録され、**精算額が倍になる**。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../server/idempotency";
import "../../../../server/env";
import { withApiObservability } from "../../../../server/instrument";
import { recordImportBatch } from "../../../../server/import-repo";
import { toExpenses } from "../../../../lib/expense-import";

async function handlePOST(req: Request): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req);
  requirePermission(user, "expense:import");
  // **キーが無ければ素通し。** 付けるのは呼び出し側の責任。
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => run(req, user!.email));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(req: Request, actor: string): Promise<Response> {
  let body: { rows?: Record<string, string>[]; errorCount?: number };
  try {
    body = (await req.json().catch(() => ({}))) as { rows?: Record<string, string>[]; errorCount?: number };
  } catch {
    return new Response("JSON の解析に失敗しました", { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return Response.json({ error: "rows(配列)が必要です" }, { status: 400 });
  }
  const expenses = toExpenses(body.rows);
  // **誰が取り込んだかを残す。**
  // 以前は `"system"` 固定で、後から「誰が入れたデータか」を辿れなかった
  const result = await recordImportBatch({
    source: "CSV", userId: actor, expenses, errorCount: body.errorCount ?? 0,
  });
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 });
  }
  return Response.json({ importId: result.value.id, inserted: expenses.length });
}

export const POST = withApiObservability("/api/expenses/import", handlePOST);
