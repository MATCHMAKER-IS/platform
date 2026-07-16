/** 対象の監査履歴 API（GET）。`?target=`。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { auditLog } from "../../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "audit:read");
  const target = new URL(req.url).searchParams.get("target");
  if (!target) return Response.json({ error: "target が必要です" }, { status: 400 });
  return Response.json({ rows: await auditLog.history(target) });
}

export const GET = withApiObservability("/api/audit/history", handleGET);
