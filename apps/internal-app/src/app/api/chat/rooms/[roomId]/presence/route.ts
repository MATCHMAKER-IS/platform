/**
 * プレゼンス API（GET）。ルームのオンライン/入力中ユーザーを返す。
 */
import { currentUser, requirePermission } from "../../../../../../server/authorize.js";
import { serverEnv } from "../../../../../../server/env.js";
import { presence } from "../../../../../../server/chat.js";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ roomId: string }> }): Promise<Response> {
  const { roomId } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");

  return Response.json(presence.snapshot(roomId, Date.now()));
}
