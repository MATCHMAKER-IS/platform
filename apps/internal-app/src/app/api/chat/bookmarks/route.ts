/**
 * 個人ブックマーク一覧 API（GET）。新しい順。
 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { pinStore } from "../../../../server/chat.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  return Response.json({ bookmarks: await pinStore.bookmarks(user!.email) });
}

export const GET = withApiObservability("/api/chat/bookmarks", handleGET);
