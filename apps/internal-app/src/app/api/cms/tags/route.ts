/** タグ操作: 一覧(GET・記事から集計)・リネーム/統合/削除(POST・全記事を一括更新)。 */
import { allTags } from "@platform/board";
import { renameTagInPosts, mergeTagsInPosts, removeTagFromPosts } from "@platform/cms";
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { cmsStore, auditActions } from "../../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  const posts = await cmsStore.list();
  return Response.json({ tags: allTags(posts) });
}

interface TagOp {
  op: "rename" | "merge" | "remove";
  from?: string;
  sources?: string[];
  to?: string;
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as TagOp;
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
