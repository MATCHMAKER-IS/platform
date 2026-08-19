/** 勤怠: 当月を上長承認へ申請(POST)。attendance:write(本人)。 */
import { withApiObservability } from "../../../../server/instrument";
// **二重送信を防ぐ。** 月次申請は連打・再送で二重に登録されると、
// **同じ申請が 2 件並ぶ**——承認者はどちらを処理すべきか分からない。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../server/idempotency";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { attendanceApprovalStore, auditActions } from "../../../../server/platform-services";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "attendance:write");
  // **キーが無ければ素通し。** 付けるのは呼び出し側の責任。
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => run(req, user!.email));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(req: Request, actor: string): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { month: string };
  if (!/^\d{4}-\d{2}$/.test(body.month ?? "")) return Response.json({ error: "月は YYYY-MM で指定してください" }, { status: 400 });
  const approval = await attendanceApprovalStore.submit(actor, body.month);
  await auditActions.record(actor, "attendance.submit", `month:${body.month}`, { after: { status: approval.status } });
  return Response.json(approval, { status: 201 });
}

export const POST = withApiObservability("/api/attendance/submit", handlePOST);
