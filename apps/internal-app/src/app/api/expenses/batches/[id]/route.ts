/** 取込バッチのロールバック API(DELETE)。当該バッチの経費を削除して取消済にする。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { rollbackImportBatch } from "../../../../../server/import-repo.js";

async function handleDELETE(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
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
