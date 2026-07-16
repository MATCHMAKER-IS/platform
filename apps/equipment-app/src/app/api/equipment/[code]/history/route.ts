/** 貸出履歴(GET・新しい順)。要ログイン。 */
import { requireUser } from "../../../../../server/guard";
import { equipmentStore } from "../../../../../server/services";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  if (!requireUser(req)) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const { code } = await ctx.params;
  return Response.json({ history: await equipmentStore.history(code) });
}
