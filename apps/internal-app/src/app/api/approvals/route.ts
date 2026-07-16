/** 伝票承認: 承認待ち一覧(GET)。approval:decide(manager以上)。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { docApprovalStore } from "../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "approval:decide");
  return Response.json({ pending: await docApprovalStore.listPending() });
}

export const GET = withApiObservability("/api/approvals", handleGET);
