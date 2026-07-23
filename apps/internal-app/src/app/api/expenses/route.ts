/** 経費一覧 API(GET)。ページネーションで新しい順に返す。 */
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { withApiObservability } from "../../../server/instrument";
import { listExpenses } from "../../../server/expense-repo";

async function handleGET(req: Request): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "expense:read:own");
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));
  const result = await listExpenses({ page, pageSize });
  return Response.json(result);
}

export const GET = withApiObservability("/api/expenses", handleGET);
