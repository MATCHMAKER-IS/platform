/** 組織デフォルトのテーマ設定(GET=取得 / POST=保存)。保存は管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { getThemeSetting, setThemeSetting, getThemeHistory } from "../../../../server/theme-setting";

async function handleGET(req: Request): Promise<Response> {
  // ?history=1 で変更履歴(誰がいつ何を変えたか)
  if (new URL(req.url).searchParams.get("history") === "1") {
    const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
    try { requirePermission(user, "admin"); } catch { return Response.json({ error: "管理者権限が必要です" }, { status: 403 }); }
    return Response.json({ history: await getThemeHistory(50) });
  }
  return Response.json(await getThemeSetting());
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try {
    requirePermission(user, "admin");
  } catch {
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  }
  const body = (await req.json()) as { skinId?: string; mode?: "light" | "dark" | "system" };
  if (!body.skinId) return Response.json({ error: "skinId が必要です" }, { status: 400 });
  const saved = await setThemeSetting({ skinId: body.skinId, mode: body.mode ?? "system", updatedBy: (user as { email?: string } | null)?.email ?? null });
  return Response.json({ ok: true, setting: saved });
}

export const GET = withApiObservability("/api/admin/theme", handleGET);
export const POST = withApiObservability("/api/admin/theme", handlePOST);
