/** 管理: 監査ダッシュボード(GET)。操作種別・操作者ごとの件数を集計。監査閲覧権限。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { auditLog } from "../../../../server/platform-services.js";
import { summarizeAudit } from "../../../../server/audit-summary.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "audit:read");
  const rows = await auditLog.query({ limit: 1000 });
  return Response.json({ summary: summarizeAudit(rows) });
}

export const GET = withApiObservability("/api/admin/audit-summary", handleGET);
