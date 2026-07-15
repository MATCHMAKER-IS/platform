/** 管理: レポート配信スケジュールの一覧(GET)・追加/有効切替/削除(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { reportScheduleStore } from "../../../../server/platform-services.js";
import { type ReportType, type ReportFrequency } from "../../../../server/report-schedule.js";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  return Response.json({ schedules: await reportScheduleStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { op?: string; reportType?: ReportType; frequency?: ReportFrequency; recipient?: string; id?: string; enabled?: boolean };
  if (body.op === "add" && body.reportType && body.frequency && body.recipient) {
    const s = await reportScheduleStore.add(body.reportType, body.frequency, body.recipient);
    return Response.json({ id: s.id }, { status: 201 });
  }
  if (body.op === "setEnabled" && body.id && typeof body.enabled === "boolean") {
    await reportScheduleStore.setEnabled(body.id, body.enabled);
    return Response.json({ id: body.id, enabled: body.enabled });
  }
  if (body.op === "remove" && body.id) {
    await reportScheduleStore.remove(body.id);
    return Response.json({ id: body.id, removed: true });
  }
  return Response.json({ error: "不正な操作です" }, { status: 400 });
}

export const GET = withApiObservability("/api/admin/report-schedule", handleGET);
export const POST = withApiObservability("/api/admin/report-schedule", handlePOST);
