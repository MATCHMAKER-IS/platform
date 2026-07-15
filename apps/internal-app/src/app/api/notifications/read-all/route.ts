/** すべて既読にする API（POST）。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { notificationStore } from "../../../../server/platform-services.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  await notificationStore.markAllRead(user!.email);
  return new Response(null, { status: 204 });
}

export const POST = withApiObservability("/api/notifications/read-all", handlePOST);
