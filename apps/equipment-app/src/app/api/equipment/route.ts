/** 備品: 一覧(GET ?includeInactive=1)・登録(POST)。要ログイン。 */
import { currentUser } from "../../../server/guard";
import { equipmentStore } from "../../../server/services";
import { validateEquipmentInput } from "../../../server/equipment-repo";

export async function GET(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const includeInactive = new URL(req.url).searchParams.get("includeInactive") === "1";
  return Response.json({ items: await equipmentStore.list(includeInactive), user: { email: user.email, name: user.name } });
}

export async function POST(req: Request): Promise<Response> {
  if (!currentUser(req)) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = (await req.json()) as Partial<{ code: string; name: string; note: string }>;
  const v = validateEquipmentInput(body);
  if (!v.ok) return Response.json({ errors: v.errors }, { status: 400 });
  if (await equipmentStore.get(v.value.code)) return Response.json({ errors: [{ field: "code", message: `コード ${v.value.code} は既に存在します` }] }, { status: 409 });
  return Response.json({ item: await equipmentStore.create(v.value) }, { status: 201 });
}
