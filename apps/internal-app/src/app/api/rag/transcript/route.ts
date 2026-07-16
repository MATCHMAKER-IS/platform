/** 文字起こし取り込み(POST {title, text, visibility})。辞書補正してから RAG に投入。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { ingestTranscript, ensureSeeded } from "../../../../server/rag-service";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try {
    requirePermission(user, "admin");
  } catch {
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  }
  await ensureSeeded();
  const body = (await req.json()) as { title?: string; text?: string; visibility?: string };
  const title = (body.title ?? "").trim();
  const text = (body.text ?? "").trim();
  if (!title || !text) return Response.json({ error: "title と text は必須です" }, { status: 400 });

  const acl = body.visibility === "public" ? { public: true } : body.visibility === "hr" ? { roles: ["hr", "admin"] } : { roles: ["admin"] };
  const r = await ingestTranscript({ id: `tr-${Date.now()}`, title, text, acl });
  return Response.json({ id: r.id, chunks: r.chunks, corrected: r.corrected, changed: r.changed });
}

export const POST = withApiObservability("/api/rag/transcript", handlePOST);
