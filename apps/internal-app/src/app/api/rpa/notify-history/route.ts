/** RPA の OS 通知履歴を返す(管理者)。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { getRpaNotifyHistory } from "../../../../server/rpa-service.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try { requirePermission(user, "admin"); } catch { return Response.json({ error: "管理者権限が必要です" }, { status: 403 }); }
  return Response.json({ history: getRpaNotifyHistory(50) });
}

export const GET = withApiObservability("/api/rpa/notify-history", handleGET);
