/** 管理: レポート配信ログの閲覧(GET)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { deliveryLogStore } from "../../../../server/platform-services.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  return Response.json({ log: await deliveryLogStore.list(50) });
}

export const GET = withApiObservability("/api/admin/report-log", handleGET);
