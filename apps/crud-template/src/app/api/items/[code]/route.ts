/** 品目: 更新(PUT・name/note)・無効化/有効化(DELETE=無効化、PATCH {active} も可)。物理削除はしない(ソフトデリート)。 */
import { itemStore } from "../../../../server/services";
import { validateItemInput } from "../../../../server/item-repo";

export async function PUT(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const cur = await itemStore.get(code);
  if (!cur) return Response.json({ error: "見つかりません" }, { status: 404 });
  const body = (await req.json()) as Partial<{ name: string; note: string }>;
  const v = validateItemInput({ code, name: body.name ?? cur.name, note: body.note ?? cur.note });
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 400 });
  const item = await itemStore.update(code, { name: v.value.name, note: v.value.note ?? "" });
  return Response.json({ item });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const body = (await req.json()) as { active?: boolean };
  const item = await itemStore.setActive(code, body.active ?? true);
  if (!item) return Response.json({ error: "見つかりません" }, { status: 404 });
  return Response.json({ item });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  const item = await itemStore.setActive(code, false);
  if (!item) return Response.json({ error: "見つかりません" }, { status: 404 });
  return Response.json({ item });
}
