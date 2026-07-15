/**
 * 入力中通知 API（POST）。プレゼンスに記録し、ルームの他接続へ入力中を同報する。
 */
import { currentUser, requirePermission } from "../../../../../../server/authorize.js";
import { serverEnv } from "../../../../../../server/env.js";
import { presence, chatGateway } from "../../../../../../server/chat.js";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:post");

  presence.typing(roomId, user!.email, Date.now());
  await chatGateway.publishTyping(roomId, user!.email);
  return new Response(null, { status: 204 });
}
