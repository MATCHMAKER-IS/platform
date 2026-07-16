/** 通知一覧 API（GET）。`?unread=1&limit=` で絞り込み。未読数も返す。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { notificationStore } from "../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const limitParam = url.searchParams.get("limit");
  const options: { unreadOnly?: boolean; limit?: number } = { unreadOnly };
  if (limitParam) options.limit = Number(limitParam) || 50;
  const [notifications, unreadCount] = await Promise.all([notificationStore.list(user!.email, options), notificationStore.unreadCount(user!.email)]);
  return Response.json({ notifications, unreadCount });
}

export const GET = withApiObservability("/api/notifications", handleGET);
