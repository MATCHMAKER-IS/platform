/**
 * ピン留め API。POST でトグル（固定/解除）し、全接続へ同報。DELETE は明示解除（トグル）。
 */
import { withApiObservability } from "../../../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../../../server/authorize";
import { serverEnv } from "../../../../../../../../server/env";
import { chatGateway } from "../../../../../../../../server/chat";

async function toggle(req: Request, roomId: string, messageId: string): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:post");
  const res = await chatGateway.pin({ roomId, messageId, userId: user!.email });
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  return Response.json({ messageId, pinned: res.pinned });
}

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string; messageId: string }> }): Promise<Response> {
  const { roomId, messageId } = await ctx.params;
  return toggle(req, roomId, messageId);
}
async function handleDELETE(req: Request, ctx: { params: Promise<{ roomId: string; messageId: string }> }): Promise<Response> {
  const { roomId, messageId } = await ctx.params;
  return toggle(req, roomId, messageId);
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/messages/[messageId]/pin", handlePOST);
export const DELETE = withApiObservability("/api/chat/rooms/[roomId]/messages/[messageId]/pin", handleDELETE);
