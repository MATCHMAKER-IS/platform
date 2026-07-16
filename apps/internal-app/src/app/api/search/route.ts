/** 横断全文検索(GET ?q=)。請求・取引先・監査(管理者のみ)を全文検索。認証ユーザー。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, userCan } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { searchIndexStore } from "../../../server/platform-services";
import { toSearchResults } from "../../../server/entity-search";
import { searchIndexed } from "../../../server/search-index";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length === 0) return Response.json({ results: [] });

  const hits = await searchIndexed(searchIndexStore, q, 30);
  // 監査ドキュメントは accounting:read 権限がなければ結果から除外
  const canAudit = userCan(user, "accounting:read");
  const filtered = canAudit ? hits : hits.filter((h) => h.document.type !== "audit");
  return Response.json({ results: toSearchResults(filtered), total: filtered.length });
}

export const GET = withApiObservability("/api/search", handleGET);
