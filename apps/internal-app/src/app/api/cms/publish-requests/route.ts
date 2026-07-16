/** 公開申請: 一覧(GET)。承認権限(cms:publish)が必要。?status= で絞れる。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { publishRequestStore } from "../../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:publish");
  const status = new URL(req.url).searchParams.get("status");
  const requests = await publishRequestStore.list(status === "pending" || status === "approved" || status === "rejected" ? { status } : {});
  return Response.json({ requests });
}

export const GET = withApiObservability("/api/cms/publish-requests", handleGET);
