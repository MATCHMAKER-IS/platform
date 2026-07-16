/** ダッシュボードのウィジェット表示設定 API。GET で取得、PUT で保存（ボディ `{ widgets }`）。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { dashboardPrefStore } from "../../../../server/platform-services";
import { normalizeWidgets } from "../../../../server/dashboard-prefs";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  return Response.json({ preference: await dashboardPrefStore.get(user!.email) });
}

async function handlePUT(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "chat:read");
  const body = (await req.json()) as { widgets?: unknown };
  await dashboardPrefStore.set(user!.email, { widgets: normalizeWidgets(body.widgets) });
  return Response.json({ preference: await dashboardPrefStore.get(user!.email) });
}

export const GET = withApiObservability("/api/dashboard/preferences", handleGET);
export const PUT = withApiObservability("/api/dashboard/preferences", handlePUT);
