/** すべて既読にする API（POST）。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { notificationStore } from "../../../../server/platform-services";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:read");
  await notificationStore.markAllRead(user!.email);
  return new Response(null, { status: 204 });
}

export const POST = withApiObservability("/api/notifications/read-all", handlePOST);
