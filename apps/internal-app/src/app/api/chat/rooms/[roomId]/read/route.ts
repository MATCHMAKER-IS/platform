/**
 * 既読設定 API（POST）。現在のルームの既読位置（lastReadAt）を保存する。
 * ボディ省略時は現在時刻。ルーム一覧の未読数はこの位置を基準に算出される。
 */
import { withApiObservability } from "../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import "../../../../../../server/env";
import { chatStore } from "../../../../../../server/chat";
import { validate, z } from "@platform/validation";

/** 既読位置の入力。**ISO 日時の形を強制する**(不正な文字列がそのまま保存されていた)。 */
const ReadInput = z.object({ at: z.string().datetime().optional() });

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "chat:read");

  const parsed = validate(ReadInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const at = parsed.value.at ?? new Date().toISOString();
  await chatStore.markRead(user!.email, roomId, at);
  return Response.json({ roomId, lastReadAt: at });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/read", handlePOST);
