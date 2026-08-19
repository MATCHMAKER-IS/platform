/** CMS 操作履歴(GET)。監査ログから cms.* のアクションを抽出する。?target= で特定コンテンツに絞れる。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { auditLog } from "../../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "cms:read");
  const target = new URL(req.url).searchParams.get("target");
  const rows = await auditLog.query({ action: "cms", ...(target ? { target } : {}), limit: 100 });
  return Response.json({ history: rows });
}

export const GET = withApiObservability("/api/cms/history", handleGET);
