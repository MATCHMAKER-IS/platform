/** 管理: エクスポートスケジュールの一覧(GET)・追加/有効切替/削除(POST)と実行履歴。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { exportScheduleStore, exportRunStore } from "../../../../server/platform-services.js";
import { type ExportType, type ExportFrequency } from "../../../../server/export-schedule.js";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const [schedules, history] = await Promise.all([exportScheduleStore.list(), exportRunStore.list(20)]);
  return Response.json({ schedules, history });
}

async function handlePOST(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { op?: string; type?: ExportType; frequency?: ExportFrequency; id?: string; enabled?: boolean };
  if (body.op === "add" && body.type && body.frequency) {
    const s = await exportScheduleStore.add(body.type, body.frequency);
    return Response.json({ id: s.id }, { status: 201 });
  }
  if (body.op === "setEnabled" && body.id && typeof body.enabled === "boolean") {
    await exportScheduleStore.setEnabled(body.id, body.enabled);
    return Response.json({ id: body.id, enabled: body.enabled });
  }
  if (body.op === "remove" && body.id) {
    await exportScheduleStore.remove(body.id);
    return Response.json({ id: body.id, removed: true });
  }
  return Response.json({ error: "不正な操作です" }, { status: 400 });
}

export const GET = withApiObservability("/api/admin/export-schedule", handleGET);
export const POST = withApiObservability("/api/admin/export-schedule", handlePOST);
