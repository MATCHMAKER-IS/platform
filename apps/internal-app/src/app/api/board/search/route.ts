/**
 * 掲示板全文検索 API（GET）。`?q=語&threadId=t1&limit=20`。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { chatSearch } from "../../../../server/chat";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "board:read");

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (q.trim().length === 0) return Response.json({ results: [] });
  const threadId = url.searchParams.get("threadId") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "20") || 20;
  const results = await chatSearch.searchPosts(q, { threadId, limit });
  return Response.json({ results });
}

export const GET = withApiObservability("/api/board/search", handleGET);
