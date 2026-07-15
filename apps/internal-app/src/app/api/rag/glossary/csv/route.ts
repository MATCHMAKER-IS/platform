/** 辞書の CSV 入出力(GET=エクスポート / POST=インポート)。管理者のみ。 */
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { exportReplacementsCsv, exportTermsCsv, importReplacementsCsv, importTermsCsv, setDictionaryActor } from "../../../../../server/rag-service.js";

function adminUser(req: Request): string | null {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try { requirePermission(user, "admin"); return (user as { email?: string } | null)?.email ?? "admin"; } catch { return null; }
}

/** GET ?kind=replacements|terms → CSV ファイルをダウンロード。 */
async function handleGET(req: Request): Promise<Response> {
  if (!adminUser(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const kind = new URL(req.url).searchParams.get("kind") ?? "replacements";
  const csv = kind === "terms" ? exportTermsCsv() : exportReplacementsCsv();
  const filename = kind === "terms" ? "glossary-terms.csv" : "glossary-replacements.csv";
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

/** POST {kind, csv} → 一括取り込み。取り込み件数を返す。 */
async function handlePOST(req: Request): Promise<Response> {
  const actor = adminUser(req);
  if (!actor) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  setDictionaryActor(actor);
  const body = (await req.json()) as { kind?: string; csv?: string };
  const csv = body.csv ?? "";
  if (!csv.trim()) return Response.json({ error: "csv が必要です" }, { status: 400 });
  const result = body.kind === "terms" ? importTermsCsv(csv) : importReplacementsCsv(csv);
  return Response.json(result);
}

export const GET = withApiObservability("/api/rag/glossary/csv", handleGET);
export const POST = withApiObservability("/api/rag/glossary/csv", handlePOST);
