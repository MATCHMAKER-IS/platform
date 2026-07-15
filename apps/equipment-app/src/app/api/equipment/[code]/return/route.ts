/** 返却(POST)。貸出中でなければ 409。要ログイン。 */
import { requireUser } from "../../../../../server/guard.js";
import { equipmentStore } from "../../../../../server/services.js";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  if (!requireUser(req)) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const { code } = await ctx.params;
  const r = await equipmentStore.giveBack(code, new Date());
  if (!r.ok) return Response.json({ error: r.error }, { status: 409 });
  return Response.json({ lending: r.lending });
}
