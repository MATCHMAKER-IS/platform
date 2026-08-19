/** 辞書の CSV 入出力(GET=エクスポート / POST=インポート)。管理者のみ。 */
import { withApiObservability } from "../../../../../server/instrument";
import { validate, z } from "@platform/validation";

const CsvInput = z.object({ kind: z.enum(["terms", "replacements"]).default("replacements"), csv: z.string().min(1, "csv が必要です") });
import { currentUser, requirePermission } from "../../../../../server/authorize";
import "../../../../../server/env";
import { exportReplacementsCsv, exportTermsCsv, importReplacementsCsv, importTermsCsv, setDictionaryActor } from "../../../../../server/rag-service";

function adminUser(req: Request): string | null {
  const user = currentUser(req);
  try { requirePermission(user, "system:manage"); return (user as { email?: string } | null)?.email ?? "admin"; } catch { return null; }
}

/** GET ?kind=replacements|terms → CSV ファイルをダウンロード。 */
async function handleGET(req: Request): Promise<Response> {
  if (!adminUser(req)) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
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
  if (!actor) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  setDictionaryActor(actor);
  const parsed = validate(CsvInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const { csv, kind } = parsed.value;
  const result = kind === "terms" ? importTermsCsv(csv) : importReplacementsCsv(csv);
  return Response.json(result);
}

export const GET = withApiObservability("/api/rag/glossary/csv", handleGET);
export const POST = withApiObservability("/api/rag/glossary/csv", handlePOST);
