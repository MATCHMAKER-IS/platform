/** 取込バッチのロールバック API(DELETE)。当該バッチの経費を削除して取消済にする。 */
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { withApiObservability } from "../../../../../server/instrument";
import { rollbackImportBatch } from "../../../../../server/import-repo";

// no-audit: 記録は `rollbackImportBatch` の中(リポジトリ層)で
// `recordAudit(tx, { action: "expense.import.rollback" })` として
// **削除と同じトランザクション**で残している。
// **ここで重ねて記録しない** —— ルート側で記録すると、
// トランザクションが巻き戻ったときに「消したことになっている記録」だけが残る。
async function handleDELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req);
  // **取り消しは参照権限では通さない。**
  // 取り込みの取り消しは影響が大きい(入れたデータが消える)
  requirePermission(user, "expense:rollback");
  const { id } = await ctx.params;
  // **誰が取り消したかを残す。**
  // 取り込みの取り消しは影響が大きいので、実行者が分からないのは困る
  const actor = user!.email;
  const result = await rollbackImportBatch(id, actor);
  if (!result.ok) {
    return Response.json({ error: result.error.message }, { status: 409 });
  }
  return Response.json({ rolledBack: result.value });
}

export const DELETE = withApiObservability("/api/expenses/batches/[id]", handleDELETE);
