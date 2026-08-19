/** 管理: 利用状況(GET)。監査ログから機能別・利用者別の利用回数を集計。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { auditLog } from "../../../../server/platform-services";
import { featureUsage } from "../../../../server/usage-analytics";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  const rows = await auditLog.query({ limit: 2000 });
  return Response.json({ usage: featureUsage(rows) });
}

export const GET = withApiObservability("/api/admin/usage", handleGET);
