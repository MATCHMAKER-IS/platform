/** 通知を既読にする API（POST）。ボディ `{ id }`。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { notificationStore } from "../../../../server/platform-services.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  const body = (await req.json()) as { id?: string };
  if (!body.id) return Response.json({ error: "id が必要です" }, { status: 400 });
  await notificationStore.markRead(user!.email, body.id);
  return new Response(null, { status: 204 });
}

export const POST = withApiObservability("/api/notifications/read", handlePOST);
