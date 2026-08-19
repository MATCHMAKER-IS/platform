/** 管理: 監査ダッシュボード(GET)。操作種別・操作者ごとの件数を集計。監査閲覧権限。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { auditLog } from "../../../../server/platform-services";
import { summarizeAudit } from "../../../../server/audit-summary";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "audit:read");
  const rows = await auditLog.query({ limit: 1000 });
  return Response.json({ summary: summarizeAudit(rows) });
}

export const GET = withApiObservability("/api/admin/audit-summary", handleGET);
