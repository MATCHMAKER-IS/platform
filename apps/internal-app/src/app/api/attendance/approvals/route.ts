/** 勤怠: 承認待ち一覧(GET)。attendance:approve(manager/admin)。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { attendanceApprovalStore } from "../../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "attendance:approve");
  return Response.json({ pending: await attendanceApprovalStore.listPending() });
}

export const GET = withApiObservability("/api/attendance/approvals", handleGET);
