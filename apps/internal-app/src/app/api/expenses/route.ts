/** 経費一覧 API(GET)。ページネーションで新しい順に返す。 */
import { currentUser, requirePermission } from "../../../server/authorize";
import "../../../server/env";
import { withApiObservability } from "../../../server/instrument";
import { listExpenses } from "../../../server/expense-repo";
import { Query } from "./spec";

async function handleGET(req: Request): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req);
  requirePermission(user, "expense:read:own");
  const url = new URL(req.url);
  // **宣言と同じスキーマで受ける。** 上限(100)もここで効く
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return Response.json({ error: "page / pageSize が不正です" }, { status: 400 });
  }
  const result = await listExpenses(parsed.data);
  return Response.json(result);
}

export const GET = withApiObservability("/api/expenses", handleGET);
