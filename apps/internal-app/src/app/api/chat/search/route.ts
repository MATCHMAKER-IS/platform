/**
 * チャット全文検索 API（GET）。`?q=語&roomId=r1&limit=20`。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { chatSearch } from "../../../../server/chat";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (q.trim().length === 0) return Response.json({ results: [] });
  const roomId = url.searchParams.get("roomId") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? "20") || 20;
  const results = await chatSearch.searchMessages(q, { roomId, limit });
  return Response.json({ results });
}

export const GET = withApiObservability("/api/chat/search", handleGET);
