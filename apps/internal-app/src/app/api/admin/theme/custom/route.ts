/**
 * カスタムテーマの管理 API。
 *   GET    ?export=1 → 保存済みカスタムテーマを JSON ファイルで書き出し
 *   GET             → 保存済みカスタムテーマ一覧
 *   POST   {theme}   → 追加・更新(1件)
 *   POST   {json}    → JSON からまとめて取り込み(束・単体どちらも可)
 *   DELETE ?id=      → 削除
 * いずれも管理者のみ。
 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { getCustomThemes, saveCustomTheme, deleteCustomTheme } from "../../../../../server/theme-setting";
import { themesToJson, themesFromJson } from "@platform/theme";
import { AppError } from "@platform/core";

function adminUser(req: Request): string | null {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try { requirePermission(user, "admin"); return (user as { email?: string } | null)?.email ?? "admin"; } catch { return null; }
}

async function handleGET(req: Request): Promise<Response> {
  if (!adminUser(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const themes = await getCustomThemes();
  if (new URL(req.url).searchParams.get("export") === "1") {
    return new Response(themesToJson(themes), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="custom-themes.json"',
      },
    });
  }
  return Response.json({ themes });
}

async function handlePOST(req: Request): Promise<Response> {
  const actor = adminUser(req);
  if (!actor) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { theme?: unknown; json?: string };
  try {
    // JSON まとめ取り込み
    if (typeof body.json === "string") {
      const parsed = themesFromJson(body.json);
      let imported = 0;
      const skipped: string[] = [];
      for (const t of parsed) {
        try { await saveCustomTheme(t, actor); imported += 1; }
        catch (e) { skipped.push(`${t.id}: ${e instanceof AppError ? e.message : "取り込めません"}`); }
      }
      return Response.json({ imported, skipped, themes: await getCustomThemes() });
    }
    // 単体保存
    if (body.theme !== undefined) {
      const saved = await saveCustomTheme(body.theme, actor);
      return Response.json({ ok: true, theme: saved, themes: await getCustomThemes() });
    }
    return Response.json({ error: "theme または json が必要です" }, { status: 400 });
  } catch (e) {
    const message = e instanceof AppError ? e.message : "保存に失敗しました";
    return Response.json({ error: message }, { status: 400 });
  }
}

async function handleDELETE(req: Request): Promise<Response> {
  const actor = adminUser(req);
  if (!actor) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id が必要です" }, { status: 400 });
  const removed = await deleteCustomTheme(id, actor);
  return Response.json({ ok: removed, themes: await getCustomThemes() });
}

export const GET = withApiObservability("/api/admin/theme/custom", handleGET);
export const POST = withApiObservability("/api/admin/theme/custom", handlePOST);
export const DELETE = withApiObservability("/api/admin/theme/custom", handleDELETE);
