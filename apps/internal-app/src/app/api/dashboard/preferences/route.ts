/** ダッシュボードのウィジェット表示設定 API。GET で取得、PUT で保存（ボディ `{ widgets }`）。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { dashboardPrefStore } from "../../../../server/platform-services";
import { normalizeWidgets } from "../../../../server/dashboard-prefs";
import { validate, z } from "@platform/validation";

// **形は zod で検証する。** `normalizeWidgets` 自身が不正値をフォールバック
// するため実害は無かったが、検査の可視性のため明示する。
const PreferenceInput = z.object({ widgets: z.unknown() });

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:read");
  return Response.json({ preference: await dashboardPrefStore.get(user!.email) });
}

async function handlePUT(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "chat:read");
  const parsed = validate(PreferenceInput, await req.json().catch(() => ({})));
  const widgets = parsed.ok ? parsed.value.widgets : undefined;
  await dashboardPrefStore.set(user!.email, { widgets: normalizeWidgets(widgets) });
  return Response.json({ preference: await dashboardPrefStore.get(user!.email) });
}

export const GET = withApiObservability("/api/dashboard/preferences", handleGET);
export const PUT = withApiObservability("/api/dashboard/preferences", handlePUT);
