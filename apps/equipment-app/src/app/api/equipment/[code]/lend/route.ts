/** 貸出(POST {borrower})。貸出中・無効品などの業務エラーは 409。要ログイン。 */
import { requireUser } from "../../../../../server/guard";
import { equipmentStore } from "../../../../../server/services";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  if (!requireUser(req)) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const { code } = await ctx.params;
  const body = (await req.json()) as { borrower?: string };
  const r = await equipmentStore.lend(code, body.borrower ?? "", new Date());
  if (!r.ok) return Response.json({ error: r.error }, { status: 409 });
  return Response.json({ lending: r.lending }, { status: 201 });
}
