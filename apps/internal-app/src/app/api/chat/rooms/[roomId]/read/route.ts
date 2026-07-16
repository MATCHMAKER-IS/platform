/**
 * 既読設定 API（POST）。現在のルームの既読位置（lastReadAt）を保存する。
 * ボディ省略時は現在時刻。ルーム一覧の未読数はこの位置を基準に算出される。
 */
import { withApiObservability } from "../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import { serverEnv } from "../../../../../../server/env";
import { chatStore } from "../../../../../../server/chat";

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");

  let at = new Date().toISOString();
  try {
    const body = (await req.json()) as { at?: string };
    if (body?.at) at = body.at;
  } catch {
    /* 本文なしは現在時刻 */
  }
  await chatStore.markRead(user!.email, roomId, at);
  return Response.json({ roomId, lastReadAt: at });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/read", handlePOST);
