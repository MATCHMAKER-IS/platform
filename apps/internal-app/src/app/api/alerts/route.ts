/** 運用アラート: 現在のアラート一覧(GET)。dashboard:read。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { buildAlerts, alertCounts } from "../../../server/alerts";
import { collectAlertInput } from "../../../server/alert-collect";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "dashboard:read");
  const alerts = buildAlerts(await collectAlertInput());
  return Response.json({ alerts, counts: alertCounts(alerts) });
}

export const GET = withApiObservability("/api/alerts", handleGET);
