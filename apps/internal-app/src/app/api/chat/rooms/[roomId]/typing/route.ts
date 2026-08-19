/**
 * 入力中通知 API（POST）。プレゼンスに記録し、ルームの他接続へ入力中を同報する。
 */
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import "../../../../../../server/env";
import { presence, chatGateway } from "../../../../../../server/chat";
import { withApiObservability } from "../../../../../../server/instrument";

export const dynamic = "force-dynamic";

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "chat:post");

  presence.typing(roomId, user!.email, Date.now());
  await chatGateway.publishTyping(roomId, user!.email);
  return new Response(null, { status: 204 });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/typing", handlePOST);
