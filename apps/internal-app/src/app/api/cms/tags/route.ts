/** タグ操作: 一覧(GET・記事から集計)・リネーム/統合/削除(POST・全記事を一括更新)。 */
import { allTags } from "@platform/board";
import { renameTagInPosts, mergeTagsInPosts, removeTagFromPosts } from "@platform/cms";
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { cmsStore, auditActions } from "../../../../server/platform-services";
import { validate, z } from "@platform/validation";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "cms:read");
  const posts = await cmsStore.list();
  return Response.json({ tags: allTags(posts) });
}

/**
 * タグ操作の入力。
 *
 * **`sources` を配列で強制する。** 型注釈だけだと文字列を渡しても
 * 実行時には素通りし、`mergeTagsInPosts` に配列でない値が渡る
 * (`op: "rename"` の場合は不要なので optional のまま)。
 */
const TagOpInput = z.object({
  op: z.enum(["rename", "merge", "remove"]),
  from: z.string().optional(),
  sources: z.array(z.string()).optional(),
  to: z.string().optional(),
});

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "cms:edit");
  const parsed = validate(TagOpInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const body = parsed.value;
  const posts = await cmsStore.list();
  let changed: { slug: string; tags: string[] }[] = [];
  if (body.op === "rename" && body.from && body.to) changed = renameTagInPosts(posts, body.from, body.to);
  else if (body.op === "merge" && body.sources && body.to) changed = mergeTagsInPosts(posts, body.sources, body.to);
  else if (body.op === "remove" && body.from) changed = removeTagFromPosts(posts, body.from);
  else return Response.json({ error: "不正な操作です" }, { status: 400 });

  // 変更のあった記事だけ更新
  for (const c of changed) {
    const post = await cmsStore.get(c.slug);
    if (!post) continue;
    await cmsStore.update(c.slug, { ...post, tags: c.tags });
  }
  await auditActions.record(user!.email, `cms.tag.${body.op}`, "tag:*", { after: { count: changed.length } });
  return Response.json({ updated: changed.length });
}

export const GET = withApiObservability("/api/cms/tags", handleGET);
export const POST = withApiObservability("/api/cms/tags", handlePOST);
