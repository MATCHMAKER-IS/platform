/** 通知を既読にする API（POST）。ボディ `{ id }`。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { notificationStore } from "../../../../server/platform-services";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:read");
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return Response.json({ error: "id が必要です" }, { status: 400 });
  await notificationStore.markRead(user!.email, body.id);
  return new Response(null, { status: 204 });
}

export const POST = withApiObservability("/api/notifications/read", handlePOST);
