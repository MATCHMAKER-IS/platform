/** 補正辞書の管理(GET一覧 / POST追加 / DELETE削除)。管理者のみ。非エンジニアが表記ゆれを登録できる。 */
import { withApiObservability } from "../../../../server/instrument";
import { auditActions } from "../../../../server/platform-services";
import { validate, z } from "@platform/validation";

/**
 * 用語辞書の入力（`term` を足すか、`from`→`to` の置換を足すか）。
 *
 * **辞書は検索クエリの補正に使われる**ので、壊れた値が入ると
 * **全社の検索結果が静かにずれる**。`addReplacement` は空文字を弾くが、
 * **数値やオブジェクトが来た場合は素通り**していた。
 */
const GlossaryInput = z.object({
  term: z.string().trim().min(1).max(100).optional(),
  from: z.string().trim().min(1).max(100).optional(),
  to: z.string().trim().max(100).optional(),
});
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { getReplacements, addReplacement, removeReplacement, getGlossaryTerms, addGlossaryTerm, removeGlossaryTerm, ensureDictionaryLoaded, isDictionaryPersistent, getDictionaryAudit, setDictionaryActor } from "../../../../server/rag-service";

/** 管理者なら実行者メールを返す。権限なしは null。 */
function adminUser(req: Request): string | null {
  const user = currentUser(req);
  try { requirePermission(user, "system:manage"); return (user as { email?: string } | null)?.email ?? "admin"; } catch { return null; }
}

async function handleGET(req: Request): Promise<Response> {
  const actor = adminUser(req);
  if (!actor) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  await ensureDictionaryLoaded();
  const url = new URL(req.url);
  if (url.searchParams.get("audit") === "1") {
    return Response.json({ audit: getDictionaryAudit(100) });
  }
  return Response.json({ replacements: getReplacements(), terms: getGlossaryTerms(), persistent: isDictionaryPersistent() });
}

async function handlePOST(req: Request): Promise<Response> {
  const actor = adminUser(req);
  if (!actor) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  setDictionaryActor(actor);
  const parsed = validate(GlossaryInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
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
  if (!actor) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  setDictionaryActor(actor);
  const params = new URL(req.url).searchParams;
  const term = params.get("term");
  if (term !== null) {
    const removed = removeGlossaryTerm(term);
    // **消したことを残す。** 用語辞書は AI の回答に効くので、
    // 「答えが急に変わった」の原因になる
    if (removed) await auditActions.record(actor, "rag.glossary.delete", `term:${term}`);
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
