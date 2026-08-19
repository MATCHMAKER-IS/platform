/**
 * ピン留め API。POST でトグル（固定/解除）し、全接続へ同報。DELETE は明示解除（トグル）。
 */
import { withApiObservability } from "../../../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../../../server/authorize";
import "../../../../../../../../server/env";
import { chatGateway } from "../../../../../../../../server/chat";

async function toggle(req: Request, roomId: string, messageId: string): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:post");
  const res = await chatGateway.pin({ roomId, messageId, userId: user!.email });
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  return Response.json({ messageId, pinned: res.pinned });
}

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string; messageId: string }> }): Promise<Response> {
  const { roomId, messageId } = await ctx.params;
  return toggle(req, roomId, messageId);
}
// no-audit: ピン留めの解除であって、メッセージは消えない(表示の切り替え)。
// **消えたものは無い**ので、監査ログに残しても「何が失われたか」を示さない。
// メッセージ本体の削除は同階層の route.ts が担い、そちらは記録している。
async function handleDELETE(req: Request, ctx: { params: Promise<{ roomId: string; messageId: string }> }): Promise<Response> {
  const { roomId, messageId } = await ctx.params;
  return toggle(req, roomId, messageId);
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/messages/[messageId]/pin", handlePOST);
export const DELETE = withApiObservability("/api/chat/rooms/[roomId]/messages/[messageId]/pin", handleDELETE);
