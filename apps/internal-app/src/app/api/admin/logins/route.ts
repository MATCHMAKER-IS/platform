/** 管理: ログイン監視(GET)。監査ログの認証イベント(target=auth)を集計・一覧。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { auditLog } from "../../../../server/platform-services.js";
import { summarizeLogins } from "../../../../server/audit-summary.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const rows = await auditLog.query({ target: "auth", limit: 200 });
  return Response.json({ summary: summarizeLogins(rows), recent: rows.slice(0, 50) });
}

export const GET = withApiObservability("/api/admin/logins", handleGET);
