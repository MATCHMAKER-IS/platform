/** 文字起こし取り込み(POST {title, text, visibility})。辞書補正してから RAG に投入。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { validate, z } from "@platform/validation";

/**
 * 議事録の取り込み。**`visibility` の扱いは ingest と同じ**(綴り違いは admin に落ちる)。
 *
 * **特に危険な入口。** 音声を文字起こしする都合上、**人事評価会議・給与改定の議論**が
 * そのままテキストになりやすい。ingest(手書き文書)より事故が起きやすいので、
 * `tags` は必須にする(既定を与えない)。
 */
const TranscriptInput = z.object({
  title: z.string().trim().min(1, "title は必須です").max(200),
  text: z.string().trim().min(1, "text は必須です").max(100_000),
  visibility: z.enum(["public", "hr", "admin"]).default("admin"),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
});
import { currentUser, requirePermission } from "../../../../server/authorize";
import { checkAiExclusion } from "@platform/ai";
import "../../../../server/env";
import { ingestTranscript, ensureSeeded } from "../../../../server/rag-service";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  try {
    requirePermission(user, "system:manage");
  } catch {
    return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  }
  await ensureSeeded();
  const parsed = validate(TranscriptInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
  const title = body.title;
  const text = body.text;

  // **登録前に弾く。** 議事録は特に事故が起きやすい入口。
  const excludeReason = checkAiExclusion({ category: body.category, tags: body.tags }, {});
  if (excludeReason) {
    return Response.json({ error: `この議事録は RAG に登録できません: ${excludeReason}` }, { status: 400 });
  }

  const acl = body.visibility === "public" ? { public: true } : body.visibility === "hr" ? { roles: ["hr", "admin"] } : { roles: ["admin"] };
  const r = await ingestTranscript({ id: `tr-${Date.now()}`, title, text, acl });
  return Response.json({ id: r.id, chunks: r.chunks, corrected: r.corrected, changed: r.changed });
}

export const POST = withApiObservability("/api/rag/transcript", handlePOST);
