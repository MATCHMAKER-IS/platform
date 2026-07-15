/** 運用アラート: 現在のアラート一覧(GET)。dashboard:read。 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { buildAlerts, alertCounts } from "../../../server/alerts.js";
import { collectAlertInput } from "../../../server/alert-collect.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "dashboard:read");
  const alerts = buildAlerts(await collectAlertInput());
  return Response.json({ alerts, counts: alertCounts(alerts) });
}

export const GET = withApiObservability("/api/alerts", handleGET);
