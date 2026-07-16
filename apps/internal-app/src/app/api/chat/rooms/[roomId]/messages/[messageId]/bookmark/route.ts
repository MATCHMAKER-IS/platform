/**
 * ブックマーク API（POST）。個人の保存をトグルする。
 */
import { withApiObservability } from "../../../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../../../server/authorize";
import { serverEnv } from "../../../../../../../../server/env";
import { pinStore } from "../../../../../../../../server/chat";

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string; messageId: string }> }): Promise<Response> {
  const { roomId, messageId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  const bookmarked = await pinStore.toggleBookmark(user!.email, messageId, roomId);
  return Response.json({ messageId, bookmarked });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/messages/[messageId]/bookmark", handlePOST);
