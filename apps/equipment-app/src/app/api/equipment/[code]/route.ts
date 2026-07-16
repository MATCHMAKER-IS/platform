/** 備品: 更新(PUT)・有効/無効(PATCH {active})。要ログイン。 */
import { requireUser } from "../../../../server/guard";
import { equipmentStore } from "../../../../server/services";
import { validateEquipmentInput } from "../../../../server/equipment-repo";

export async function PUT(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  if (!requireUser(req)) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const { code } = await ctx.params;
  const cur = await equipmentStore.get(code);
  if (!cur) return Response.json({ error: "見つかりません" }, { status: 404 });
  const body = (await req.json()) as Partial<{ name: string; note: string }>;
  const v = validateEquipmentInput({ code, name: body.name ?? cur.name, note: body.note ?? cur.note });
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 400 });
  const item = await equipmentStore.update(code, { name: v.value.name, note: v.value.note ?? "" });
  return Response.json({ item });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  if (!requireUser(req)) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const { code } = await ctx.params;
  const body = (await req.json()) as { active?: boolean };
  const item = await equipmentStore.setActive(code, body.active ?? true);
  if (!item) return Response.json({ error: "見つかりません" }, { status: 404 });
  return Response.json({ item });
}
