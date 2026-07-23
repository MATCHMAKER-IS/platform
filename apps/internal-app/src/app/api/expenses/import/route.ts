/** 経費取込 API(POST)。取込行を Expense に変換し、バッチ記録+監査つきで一括作成する。 */
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { withApiObservability } from "../../../../server/instrument";
import { recordImportBatch } from "../../../../server/import-repo";
import { toExpenses } from "../../../../lib/expense-import";

async function handlePOST(req: Request): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "expense:import");
  let body: { rows?: Record<string, string>[]; errorCount?: number };
  try {
    body = (await req.json()) as { rows?: Record<string, string>[]; errorCount?: number };
  } catch {
    return new Response("JSON の解析に失敗しました", { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return Response.json({ error: "rows(配列)が必要です" }, { status: 400 });
  }
  const expenses = toExpenses(body.rows);
  // 実運用では認証セッションから userId を得る
  const result = await recordImportBatch({ source: "CSV", userId: "system", expenses, errorCount: body.errorCount ?? 0 });
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 500 });
  }
  return Response.json({ importId: result.value.id, inserted: expenses.length });
}

export const POST = withApiObservability("/api/expenses/import", handlePOST);
