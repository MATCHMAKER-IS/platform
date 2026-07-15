/** 補正辞書の管理(GET一覧 / POST追加 / DELETE削除)。管理者のみ。非エンジニアが表記ゆれを登録できる。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { getReplacements, addReplacement, removeReplacement, getGlossaryTerms, addGlossaryTerm, removeGlossaryTerm, ensureDictionaryLoaded, isDictionaryPersistent, getDictionaryAudit, setDictionaryActor } from "../../../../server/rag-service.js";

/** 管理者なら実行者メールを返す。権限なしは null。 */
function adminUser(req: Request): string | null {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try { requirePermission(user, "admin"); return (user as { email?: string } | null)?.email ?? "admin"; } catch { return null; }
}

async function handleGET(req: Request): Promise<Response> {
  const actor = adminUser(req);
  if (!actor) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  await ensureDictionaryLoaded();
  const url = new URL(req.url);
  if (url.searchParams.get("audit") === "1") {
    return Response.json({ audit: getDictionaryAudit(100) });
  }
  return Response.json({ replacements: getReplacements(), terms: getGlossaryTerms(), persistent: isDictionaryPersistent() });
}

async function handlePOST(req: Request): Promise<Response> {
  const actor = adminUser(req);
  if (!actor) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  setDictionaryActor(actor);
  const body = (await req.json()) as { from?: string; to?: string; term?: string };
  if (body.term !== undefined) {
    const okAdd = addGlossaryTerm(body.term);
    return Response.json({ ok: okAdd, terms: getGlossaryTerms() });
  }
  if (body.from !== undefined && body.to !== undefined) {
    const okAdd = addReplacement({ from: body.from, to: body.to });
    if (!okAdd) return Response.json({ error: "from が空です" }, { status: 400 });
    return Response.json({ ok: true, replacements: getReplacements() });
  }
  return Response.json({ error: "from+to または term が必要です" }, { status: 400 });
}

async function handleDELETE(req: Request): Promise<Response> {
  const actor = adminUser(req);
  if (!actor) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  setDictionaryActor(actor);
  const params = new URL(req.url).searchParams;
  const term = params.get("term");
  if (term !== null) {
    const removed = removeGlossaryTerm(term);
    return Response.json({ ok: removed, terms: getGlossaryTerms() });
  }
  const from = params.get("from");
  if (!from) return Response.json({ error: "from または term が必要です" }, { status: 400 });
  const removed = removeReplacement(from);
  return Response.json({ ok: removed, replacements: getReplacements() });
}

export const GET = withApiObservability("/api/rag/glossary", handleGET);
export const POST = withApiObservability("/api/rag/glossary", handlePOST);
export const DELETE = withApiObservability("/api/rag/glossary", handleDELETE);
