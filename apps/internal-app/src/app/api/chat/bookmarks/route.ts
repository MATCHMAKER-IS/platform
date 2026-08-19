/**
 * 個人ブックマーク一覧 API（GET）。新しい順。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { pinStore } from "../../../../server/chat";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:read");
  return Response.json({ bookmarks: await pinStore.bookmarks(user!.email) });
}

export const GET = withApiObservability("/api/chat/bookmarks", handleGET);
