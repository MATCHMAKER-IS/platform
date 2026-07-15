/**
 * メンバー追加 API（POST）。ルームに参加者を加える。ボディ `{ userId }`。
 * 追加できるのはそのルームのメンバーのみ（招待）。
 */
import { withApiObservability } from "../../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../../server/authorize.js";
import { serverEnv } from "../../../../../../server/env.js";
import { roomRepo } from "../../../../../../server/chat.js";

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:post");

  if (!(await roomRepo.isMember(roomId, user!.email))) {
    return Response.json({ error: "このルームのメンバーではありません" }, { status: 403 });
  }
  const body = (await req.json()) as { userId?: string };
  const userId = (body.userId ?? "").trim();
  if (userId.length === 0) return Response.json({ error: "userId が必要です" }, { status: 400 });

  await roomRepo.addMember(roomId, userId);
  return Response.json({ roomId, userId }, { status: 201 });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/members", handlePOST);
