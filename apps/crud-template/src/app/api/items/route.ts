/**
 * 品目: 一覧(GET ?includeInactive=1)・登録(POST)。
 *
 * **この形が API の標準**: 認可 → 実処理 → 監査 を、withApi で包んで書く。
 *   1. requirePermission … 権限が無ければ 403(例外は withApi が整えて返す)
 *   2. 実処理
 *   3. recordAudit … 業務上あとから説明が要る操作だけ記録する(参照は記録しない)
 */
import { itemStore } from "../../../server/services";
import { validateItemInput } from "../../../server/item-repo";
import { currentUser, requirePermission } from "../../../server/authorize";
import { withApi, recordAudit } from "../../../server/instrument";

export const GET = withApi("/api/items", async (req: Request) => {
  requirePermission(currentUser(req), "item:read");
  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "1";
  return Response.json({ items: await itemStore.list(includeInactive) });
});

export const POST = withApi("/api/items", async (req: Request) => {
  const user = requirePermission(currentUser(req), "item:write");

  const body = (await req.json()) as Partial<{ code: string; name: string; note: string }>;
  const v = validateItemInput(body);
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 400 });
  if (await itemStore.get(v.value.code)) {
    return Response.json({ errors: [{ field: "code", message: `コード ${v.value.code} は既に存在します` }] }, { status: 409 });
  }

  const item = await itemStore.create(v.value);
  recordAudit({
    at: new Date().toISOString(),
    actor: user.id,
    action: "item.create",
    target: `item:${item.code}`,
    after: { code: item.code, name: item.name },
  });
  return Response.json({ item }, { status: 201 });
});
