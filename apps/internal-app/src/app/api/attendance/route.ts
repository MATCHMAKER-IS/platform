/** 勤怠: 当月の勤務表(GET)・打刻記録(POST)。本人の勤怠を対象(attendance:read/write)。 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, requirePermission } from "../../../server/authorize";
import { serverEnv } from "../../../server/env";
import { attendanceStore, attendanceApprovalStore, auditActions } from "../../../server/platform-services";
import { type AttendanceEntry } from "../../../server/attendance-repo";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "attendance:read");
  const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  const summary = await attendanceStore.monthly(user!.email, month);
  const approval = await attendanceApprovalStore.get(user!.email, month);
  return Response.json({ ...summary, approval: approval ?? null });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "attendance:write");
  const body = (await req.json()) as AttendanceEntry;
  if (!body.date || !body.clockIn || !body.clockOut) return Response.json({ error: "日付・出勤・退勤は必須です" }, { status: 400 });
  if (!/^\d{1,2}:\d{2}$/.test(body.clockIn) || !/^\d{1,2}:\d{2}$/.test(body.clockOut)) return Response.json({ error: "時刻は HH:MM で入力してください" }, { status: 400 });
  const day = await attendanceStore.record(user!.email, body);
  await auditActions.record(user!.email, "attendance.record", `date:${body.date}`, { after: { totalMinutes: day.totalMinutes } });
  return Response.json(day, { status: 201 });
}

export const GET = withApiObservability("/api/attendance", handleGET);
export const POST = withApiObservability("/api/attendance", handlePOST);
