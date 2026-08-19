/**
 * 品目: 一覧(GET ?includeInactive=1&keyword=&page=1&pageSize=20)・登録(POST)。
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
  const params = new URL(req.url).searchParams;
  const includeInactive = params.get("includeInactive") === "1";

  // **数値は必ず絞る。** クエリ文字列は利用者が自由に書けるので、
  // `?page=-1` や `?pageSize=100000` がそのまま来る。
  // 上限は `listPage` 側でも掛けているが、**入口でも見ておく**——
  // 別の呼び出し元が増えたときに守りが 1 枚残る
  const num = (key: string, fallback: number): number => {
    const raw = Number(params.get(key));
    return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : fallback;
  };

  // **返す形を変えた**(2026-08)。以前は `{ items }` だけで、
  // **総件数が分からず「全部見たのか」が判断できなかった**。
  // `items` は残してあるので、古い呼び出し元も壊れない
  const page = await itemStore.listPage({
    includeInactive,
    keyword: params.get("keyword") ?? "",
    page: num("page", 1),
    pageSize: num("pageSize", 20),
  });
  return Response.json(page);
});

export const POST = withApi("/api/items", async (req: Request) => {
  const user = requirePermission(currentUser(req), "item:write");

  const body = (await req.json().catch(() => ({}))) as Partial<{ code: string; name: string; note: string }>;
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
