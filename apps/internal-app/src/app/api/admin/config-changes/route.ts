/** 管理: 設定変更履歴(GET)。監査ログから設定・管理系の変更を抽出。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { auditLog } from "../../../../server/platform-services.js";
import { configChanges } from "../../../../server/usage-analytics.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const rows = await auditLog.query({ limit: 1000 });
  return Response.json({ changes: configChanges(rows).slice(0, 100) });
}

export const GET = withApiObservability("/api/admin/config-changes", handleGET);
