/**
 * リアクション API（POST）。メッセージにリアクションをトグルし、最新カウントを全接続へ同報する。
 * ボディ `{ kind }`。
 */
import { withApiObservability } from "../../../../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../../../../server/authorize.js";
import { serverEnv } from "../../../../../../../../server/env.js";
import { chatGateway } from "../../../../../../../../server/chat.js";

async function handlePOST(req: Request, ctx: { params: Promise<{ roomId: string; messageId: string }> }): Promise<Response> {
  const { roomId, messageId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:post");

  const body = (await req.json()) as { kind?: string };
  const kind = (body.kind ?? "").trim();
  if (kind.length === 0) return Response.json({ error: "kind が必要です" }, { status: 400 });

  const res = await chatGateway.react({ roomId, messageId, userId: user!.email, kind });
  if (!res.ok) return Response.json({ error: res.error }, { status: 400 });
  return Response.json({ messageId, counts: res.counts });
}

export const POST = withApiObservability("/api/chat/rooms/[roomId]/messages/[messageId]/reactions", handlePOST);
