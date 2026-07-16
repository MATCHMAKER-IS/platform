/** 勤怠: 申請の承認/却下(POST)。attendance:approve(manager/admin)。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission, userCan } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { attendanceApprovalStore, auditActions } from "../../../../../server/platform-services";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "attendance:approve");
  const body = (await req.json()) as { userId: string; month: string; action: "approve" | "reject"; reason?: string };
  if (!body.userId || !body.month || !["approve", "reject"].includes(body.action)) return Response.json({ error: "userId・month・action(approve/reject)が必要です" }, { status: 400 });
  if (body.action === "reject" && !body.reason) return Response.json({ error: "却下には理由が必要です" }, { status: 400 });
  // policy が承認を認めている場合、ワークフローの上長ロールを満たす actor を組み立てる
  const roles = userCan(user!, "attendance:approve") ? Array.from(new Set([...user!.roles, "manager"])) : user!.roles;
  const actor = { id: user!.email, roles };
  const result = await attendanceApprovalStore.decide(body.userId, body.month, actor, body.action, body.reason);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  await auditActions.record(user!.email, `attendance.${body.action}`, `${body.userId}:${body.month}`, { after: { status: result.approval.status } });
  return Response.json(result.approval);
}

export const POST = withApiObservability("/api/attendance/approvals/decision", handlePOST);
