/** RAG 文書登録(POST {title, body, acl})。管理者のみ。ACL でアクセス範囲を明示する。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { ragStore, ensureSeeded } from "../../../../server/rag-service.js";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  try {
    requirePermission(user, "admin");
  } catch {
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  }
  await ensureSeeded();
  const body = (await req.json()) as { title?: string; body?: string; visibility?: string };
  const title = (body.title ?? "").trim();
  const text = (body.body ?? "").trim();
  if (!title || !text) return Response.json({ error: "title と body は必須です" }, { status: 400 });

  // visibility: public / hr / admin をわかりやすい ACL に変換
  const acl = body.visibility === "public" ? { public: true } : body.visibility === "hr" ? { roles: ["hr", "admin"] } : { roles: ["admin"] };
  const id = `doc-${Date.now()}`;
  const r = await ragStore.ingest([{ id, title, body: text, source: "手動登録", acl }]);
  if (!r.ok) return Response.json({ error: r.error.message }, { status: 500 });
  return Response.json({ id, chunks: r.value.chunks });
}

export const POST = withApiObservability("/api/rag/ingest", handlePOST);
