/** レポートプリセットの一覧(GET)・追加/削除(POST)。認証ユーザー（自分のプリセット）。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { reportPresetStore } from "../../../../server/platform-services.js";
import { type PresetReportType } from "../../../../server/report-preset.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  return Response.json({ presets: await reportPresetStore.list(user.email) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  const body = (await req.json()) as { op?: string; name?: string; reportType?: PresetReportType; from?: string; to?: string; partner?: string; id?: string };
  if (body.op === "add" && body.name && body.reportType) {
    const p = await reportPresetStore.add(user.email, { name: body.name, reportType: body.reportType, ...(body.from ? { from: body.from } : {}), ...(body.to ? { to: body.to } : {}), ...(body.partner ? { partner: body.partner } : {}) });
    return Response.json({ id: p.id }, { status: 201 });
  }
  if (body.op === "remove" && body.id) {
    await reportPresetStore.remove(user.email, body.id);
    return Response.json({ id: body.id, removed: true });
  }
  return Response.json({ error: "不正な操作です" }, { status: 400 });
}

export const GET = withApiObservability("/api/reports/presets", handleGET);
export const POST = withApiObservability("/api/reports/presets", handlePOST);
