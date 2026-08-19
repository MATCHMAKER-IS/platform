/** RPA の OS 通知履歴を返す(管理者)。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { getRpaNotifyHistory } from "../../../../server/rpa-service";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  try { requirePermission(user, "system:manage"); } catch { return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 }); }
  return Response.json({ history: getRpaNotifyHistory(50) });
}

export const GET = withApiObservability("/api/rpa/notify-history", handleGET);
