/**
 * 品目: 更新(PUT・name/note)・無効化/有効化(DELETE=無効化、PATCH {active} も可)。
 * 物理削除はしない(ソフトデリート)。**消えると後から追えない**ため。
 *
 * 変更系は「変更前・変更後」を監査に残す。何が起きたかを後から説明できるようにするため。
 */
import { itemStore } from "../../../../server/services";
import { validateItemInput } from "../../../../server/item-repo";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { withApi, recordAudit } from "../../../../server/instrument";

export const PUT = withApi("/api/items/[code]", async (req: Request, ctx?: unknown) => {
  const user = requirePermission(currentUser(req), "item:write");
  const { code } = await (ctx as { params: Promise<{ code: string }> }).params;

  const cur = await itemStore.get(code);
  if (!cur) return Response.json({ error: "見つかりません" }, { status: 404 });

  const body = (await req.json()) as Partial<{ name: string; note: string }>;
  const v = validateItemInput({ code, name: body.name ?? cur.name, note: body.note ?? cur.note });
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 400 });

  const item = await itemStore.update(code, { name: v.value.name, note: v.value.note ?? "" });
  recordAudit({
    at: new Date().toISOString(),
    actor: user.id,
    action: "item.update",
    target: `item:${code}`,
    before: { name: cur.name, note: cur.note },
    after: { name: v.value.name, note: v.value.note ?? "" },
  });
  return Response.json({ item });
});

export const PATCH = withApi("/api/items/[code]", async (req: Request, ctx?: unknown) => {
  const user = requirePermission(currentUser(req), "item:write");
  const { code } = await (ctx as { params: Promise<{ code: string }> }).params;

  const body = (await req.json()) as { active?: boolean };
  const active = body.active ?? true;
  const item = await itemStore.setActive(code, active);
  if (!item) return Response.json({ error: "見つかりません" }, { status: 404 });

  recordAudit({
    at: new Date().toISOString(),
    actor: user.id,
    action: active ? "item.activate" : "item.deactivate",
    target: `item:${code}`,
    after: { active },
  });
  return Response.json({ item });
});

/**
 * 無効化(ソフトデリート)。物理削除ではないので、後から有効化に戻せる。
 * REST の DELETE を「消す」ではなく「使わなくする」に割り当てている。
 */
export const DELETE = withApi("/api/items/[code]", async (req: Request, ctx?: unknown) => {
  const user = requirePermission(currentUser(req), "item:write");
  const { code } = await (ctx as { params: Promise<{ code: string }> }).params;

  const item = await itemStore.setActive(code, false);
  if (!item) return Response.json({ error: "見つかりません" }, { status: 404 });

  recordAudit({
    at: new Date().toISOString(),
    actor: user.id,
    action: "item.deactivate",
    target: `item:${code}`,
    after: { active: false },
  });
  return Response.json({ item });
});
