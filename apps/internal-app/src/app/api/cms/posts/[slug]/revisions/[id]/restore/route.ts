/** リビジョンから記事を復元(POST)。下書きとして書き戻す。編集権限が必要。 */
import { withApiObservability } from "../../../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../../../server/authorize";
import { serverEnv } from "../../../../../../../../server/env";
import { cmsStore, auditActions, revisionStore } from "../../../../../../../../server/platform-services";
import { revisionToInput } from "@platform/cms";

async function handlePOST(req: Request, ctx: { params: Promise<{ slug: string; id: string }> }): Promise<Response> {
  const { slug, id } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const rev = await revisionStore.get(id);
  if (!rev || rev.postSlug !== slug) return Response.json({ error: "リビジョンが見つかりません" }, { status: 404 });
  const post = await cmsStore.update(slug, revisionToInput(rev, slug));
  if (!post) return Response.json({ error: "記事が見つかりません" }, { status: 404 });
  await revisionStore.record(post, user!.email);
  await auditActions.record(user!.email, "cms.post.restore", `post:${slug}`, { after: { version: rev.version } });
  return Response.json(post);
}

export const POST = withApiObservability("/api/cms/posts/[slug]/revisions/[id]/restore", handlePOST);
