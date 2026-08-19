/** RAG 文書登録(POST {title, body, acl})。管理者のみ。ACL でアクセス範囲を明示する。 */
import { withApiObservability } from "../../../../server/instrument";
import { validate, z } from "@platform/validation";

/**
 * 取り込みの入力。
 *
 * **`visibility` の綴りを間違えると、黙って `admin` 限定になる。**
 * 三項演算子の最後に落ちるためで、エラーは出ない——
 * 「全社に公開したつもりが、管理者しか読めない」に気づくのは
 * **誰かが「その資料が出てこない」と言い出したとき**である。
 *
 * 逆向きの事故も同じ形で起きうる: `hr` と書くつもりが `public` になれば、
 * **人事資料が全社の検索に載る**。ここは弾いておく価値が高い。
 */
const IngestInput = z.object({
  title: z.string().trim().min(1, "title は必須です").max(200),
  body: z.string().trim().min(1, "body は必須です").max(100_000),
  visibility: z.enum(["public", "hr", "admin"]).default("admin"),
  /**
   * この文書の分類・印。
   *
   * **`checkAiExclusion` の判定材料。** 既定で `no-ai` / `confidential` / `社外秘`
   * のいずれかが付いていれば、**登録そのものを拒否する**。
   * 一度ベクトル化して索引に入ると、誰かの質問で引かれる——
   * 「山田さんの評価は」と聞かれて答えてしまう形で表に出る。
   * **入れる前に弾くしかない。** 入れてから消しても、その間に引かれた分は取り返せない。
   */
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
});
import { currentUser, requirePermission } from "../../../../server/authorize";
import { checkAiExclusion } from "@platform/ai";
import "../../../../server/env";
import { ragStore, ensureSeeded } from "../../../../server/rag-service";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  try {
    requirePermission(user, "system:manage");
  } catch {
    return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  }
  await ensureSeeded();
  const parsed = validate(IngestInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
  const title = body.title;
  const text = body.body;

  // **登録前に弾く。** 迷ったら弾く方が安全——「入れて良かったのに弾かれた」は
  // 後から直せるが、「入れてはいけなかった」は取り返せない。
  const excludeReason = checkAiExclusion(
    { category: body.category, tags: body.tags },
    {},
  );
  if (excludeReason) {
    return Response.json({ error: `この文書は RAG に登録できません: ${excludeReason}` }, { status: 400 });
  }

  // visibility: public / hr / admin をわかりやすい ACL に変換
  const acl = body.visibility === "public" ? { public: true } : body.visibility === "hr" ? { roles: ["hr", "admin"] } : { roles: ["admin"] };
  const id = `doc-${Date.now()}`;
  const r = await ragStore.ingest([{ id, title, body: text, source: "手動登録", acl }]);
  if (!r.ok) return Response.json({ error: r.error.message }, { status: 500 });
  return Response.json({ id, chunks: r.value.chunks });
}

export const POST = withApiObservability("/api/rag/ingest", handlePOST);
