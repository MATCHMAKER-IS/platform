/**
 * ルームのピン留め一覧 API（GET）。新しい順。
 */
import { withApiObservability } from "../../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../../server/authorize.js";
import { serverEnv } from "../../../../../../server/env.js";
import { pinStore } from "../../../../../../server/chat.js";

async function handleGET(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  return Response.json({ pins: await pinStore.pins(roomId) });
}

export const GET = withApiObservability("/api/chat/rooms/[roomId]/pins", handleGET);
