/**
 * メンバー追加 API（POST）。ルームに参加者を加える。ボディ `{ userId }`。
 * 追加できるのはそのルームのメンバーのみ（招待）。
 */
import { withApiObservability } from "../../../../../../server/instrument";
import { validate, z } from "@platform/validation";

/** 入力の形。**文字列を強制する**(数値や配列を渡しても通っていた)。 */
const AddMemberInput = z.object({ userId: z.string().trim().min(1, "userId が必要です") });
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import "../../../../../../server/env";
import { roomRepo } from "../../../../../../server/chat";

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req);
  requirePermission(user, "chat:post");

  if (!(await roomRepo.isMember(roomId, user!.email))) {
    return Response.json({ error: "このルームのメンバーではありません" }, { status: 403 });
  }
  const parsed = validate(AddMemberInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const userId = parsed.value.userId;

  await roomRepo.addMember(roomId, userId);
  return Response.json({ roomId, userId }, { status: 201 });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/members", handlePOST);
