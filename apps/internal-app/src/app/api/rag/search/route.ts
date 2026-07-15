/** RAG 検索(POST {query}). ログイン中ユーザーのロールを継承して検索(権限のない文書は返らない)。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { ragStore, ensureSeeded, normalizeTranscript } from "../../../../server/rag-service.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user) return Response.json({ error: "認証が必要です" }, { status: 401 });
  await ensureSeeded();
  const body = (await req.json()) as { query?: string };
  const rawQuery = (body.query ?? "").trim();
  if (!rawQuery) return Response.json({ error: "query は必須です" }, { status: 400 });
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
