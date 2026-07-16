/**
 * チャット送信 API（POST）。認可 → 検証 → 全接続へ同報（メンションは通知）。
 */
import { withApiObservability } from "../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import { serverEnv } from "../../../../../../server/env";
import { chatGateway } from "../../../../../../server/chat";
import type { Attachment } from "@platform/chat";

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:post");

  const body = (await req.json()) as { text?: string; replyTo?: string; attachments?: Attachment[] };
  const res = await chatGateway.send({
    roomId,
    senderId: user!.email,
    text: body.text ?? "",
    replyTo: body.replyTo,
    attachments: body.attachments,
  });
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  return Response.json(res.message, { status: 201 });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/messages", handlePOST);
