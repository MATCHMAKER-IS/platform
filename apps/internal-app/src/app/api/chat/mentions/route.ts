/**
 * 未読メンション API（GET）。`?handle=` で対象ハンドル（省略時はメールのローカル部）。
 * count と一覧（新しい順）を返す。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { mentionInbox } from "../../../../server/chat";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  const handle = new URL(req.url).searchParams.get("handle") ?? user!.email.split("@")[0]!;
  const [count, items] = await Promise.all([mentionInbox.unreadCount(user!.email, handle), mentionInbox.unread(user!.email, handle)]);
  return Response.json({ count, mentions: items });
}

export const GET = withApiObservability("/api/chat/mentions", handleGET);
