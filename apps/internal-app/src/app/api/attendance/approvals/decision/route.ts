/** 勤怠: 申請の承認/却下/差し戻し(POST)。attendance:approve(manager/admin)。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission, userCan } from "../../../../../server/authorize";
import "../../../../../server/env";
import { attendanceApprovalStore, auditActions } from "../../../../../server/platform-services";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "attendance:approve");
  const body = (await req.json().catch(() => ({}))) as { userId: string; month: string; action: "approve" | "reject" | "sendback"; reason?: string };
  // **`sendback` を受け付ける。** 以前はリポジトリ層に実装があっても
  // ここで弾いていて、API 経由では差し戻せなかった(2026-08、
  // attendance-approval-repo.ts の機能欠落を発見・修正したのに合わせて解消)。
  if (!body.userId || !body.month || !["approve", "reject", "sendback"].includes(body.action)) return Response.json({ error: "userId・month・action(approve/reject/sendback)が必要です" }, { status: 400 });
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
