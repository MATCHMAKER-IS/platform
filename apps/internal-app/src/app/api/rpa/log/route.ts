/** RPA 監査ログ取得(GET)。管理者のみ。直近のイベントを返す。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { rpaAuditLog } from "../../../../server/rpa-service";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try {
    requirePermission(user, "admin");
  } catch {
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  }
  return Response.json({ events: rpaAuditLog.slice(-50).reverse() });
}

export const GET = withApiObservability("/api/rpa/log", handleGET);
