/** 勤怠: 当月を上長承認へ申請(POST)。attendance:write(本人)。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { attendanceApprovalStore, auditActions } from "../../../../server/platform-services";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "attendance:write");
  const body = (await req.json()) as { month: string };
  if (!/^\d{4}-\d{2}$/.test(body.month ?? "")) return Response.json({ error: "月は YYYY-MM で指定してください" }, { status: 400 });
  const approval = await attendanceApprovalStore.submit(user!.email, body.month);
  await auditActions.record(user!.email, "attendance.submit", `month:${body.month}`, { after: { status: approval.status } });
  return Response.json(approval, { status: 201 });
}

export const POST = withApiObservability("/api/attendance/submit", handlePOST);
