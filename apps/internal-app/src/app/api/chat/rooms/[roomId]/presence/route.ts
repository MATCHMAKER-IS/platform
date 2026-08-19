/**
 * プレゼンス API（GET）。ルームのオンライン/入力中ユーザーを返す。
 */
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import "../../../../../../server/env";
import { presence } from "../../../../../../server/chat";
import { withApiObservability } from "../../../../../../server/instrument";

export const dynamic = "force-dynamic";

async function handleGET(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "chat:read");

  return Response.json(presence.snapshot(roomId, Date.now()));
}

export const GET = withApiObservability("/api/chat/rooms/[roomId]/presence", handleGET);
