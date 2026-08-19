/**
 * リアクション API（POST）。メッセージにリアクションをトグルし、最新カウントを全接続へ同報する。
 * ボディ `{ kind }`。
 */
import { withApiObservability } from "../../../../../../../../server/instrument";
import { validate, z } from "@platform/validation";

/** 入力の形。**文字列を強制する**(数値や配列を渡しても通っていた)。 */
const ReactionInput = z.object({ kind: z.string().trim().min(1, "kind が必要です") });
import { currentUser, requirePermission } from "../../../../../../../../server/authorize";
import "../../../../../../../../server/env";
import { chatGateway } from "../../../../../../../../server/chat";

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string; messageId: string }> }): Promise<Response> {
  const { roomId, messageId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "chat:post");

  const parsed = validate(ReactionInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const kind = parsed.value.kind;

  const res = await chatGateway.react({ roomId, messageId, userId: user!.email, kind });
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  return Response.json({ messageId, counts: res.counts });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/messages/[messageId]/reactions", handlePOST);
