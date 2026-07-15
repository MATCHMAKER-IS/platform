/** 管理: 利用状況(GET)。監査ログから機能別・利用者別の利用回数を集計。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { auditLog } from "../../../../server/platform-services.js";
import { featureUsage } from "../../../../server/usage-analytics.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const rows = await auditLog.query({ limit: 2000 });
  return Response.json({ usage: featureUsage(rows) });
}

export const GET = withApiObservability("/api/admin/usage", handleGET);
