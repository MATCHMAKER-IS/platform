/**
 * 品目: 一覧(GET ?includeInactive=1)・登録(POST)。
 * 認可を足す場合: internal-app の authorize.ts を移植し、冒頭で currentUser → requirePermission を呼ぶ(docs/ai/patterns.md 参照)。
 */
import { itemStore } from "../../../server/services.js";
import { validateItemInput } from "../../../server/item-repo.js";

export async function GET(req: Request): Promise<Response> {
  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "1";
  return Response.json({ items: await itemStore.list(includeInactive) });
}

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as Partial<{ code: string; name: string; note: string }>;
  const v = validateItemInput(body);
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 400 });
  if (await itemStore.get(v.value.code)) return Response.json({ errors: [{ field: "code", message: `コード ${v.value.code} は既に存在します` }] }, { status: 409 });
  return Response.json({ item: await itemStore.create(v.value) }, { status: 201 });
}
