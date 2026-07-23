/** 取込バッチのロールバック API(DELETE)。当該バッチの経費を削除して取消済にする。 */
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { withApiObservability } from "../../../../../server/instrument";
import { rollbackImportBatch } from "../../../../../server/import-repo";

async function handleDELETE(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "expense:read:own");
  const { id } = await ctx.params;
  // 実運用では認証セッションから actor を得る
  const actor = "system";
  const result = await rollbackImportBatch(id, actor);
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 409 });
  }
  return Response.json({ rolledBack: result.value });
}

export const DELETE = withApiObservability("/api/expenses/batches/[id]", handleDELETE);
