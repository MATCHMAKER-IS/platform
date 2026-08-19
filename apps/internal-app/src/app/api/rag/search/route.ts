/** RAG 検索(POST {query}). ログイン中ユーザーのロールを継承して検索(権限のない文書は返らない)。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { ragStore, ensureSeeded, normalizeTranscript } from "../../../../server/rag-service";
import { validate, z } from "@platform/validation";

const SearchInput = z.object({ query: z.string().trim().min(1, "query は必須です").max(500) });

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  await ensureSeeded();
  const parsed = validate(SearchInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const rawQuery = parsed.value.query;
  // 検索クエリも辞書補正(ユーザーが誤変換のまま入力しても正しい語で検索)
  const normalized = normalizeTranscript(rawQuery);
  const query = normalized.corrected;

  const roles = (user as { roles?: string[] }).roles ?? [];
  const r = await ragStore.retrieve(query, { id: user.email, roles }, 5);
  if (!r.ok) return Response.json({ error: r.error.message }, { status: 400 });
  return Response.json({
    hits: r.value.map((h) => ({ title: h.chunk.title, source: h.chunk.source, text: h.chunk.text, score: Math.round(h.score * 1000) / 1000 })),
    principal: { email: user.email, roles },
    // 辞書補正の可視化: 入力がそのまま使われたか、辞書で直されたか
    normalization: { raw: rawQuery, corrected: query, changed: normalized.changed },
  });
}

export const POST = withApiObservability("/api/rag/search", handlePOST);
