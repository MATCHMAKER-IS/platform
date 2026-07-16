/** 公開申請の承認/却下(POST)。承認時は対象記事を公開する。cms:publish が必要。 */
import { withApiObservability } from "../../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../../server/authorize";
import { serverEnv } from "../../../../../../server/env";
import { cmsStore, auditActions, publishRequestStore, notificationCenter } from "../../../../../../server/platform-services";

async function handlePOST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:publish");
  const body = (await req.json()) as { decision: "approved" | "rejected"; note?: string };
  if (body.decision !== "approved" && body.decision !== "rejected") return Response.json({ error: "decision が不正です" }, { status: 400 });

  const request = await publishRequestStore.get(id);
  if (!request) return Response.json({ error: "申請が見つかりません" }, { status: 404 });

  const decided = await publishRequestStore.decide(id, body.decision, user!.email, body.note);

  // 承認 → 対象記事を公開
  if (body.decision === "approved") {
    const post = await cmsStore.get(request.postSlug);
    if (post) {
      await cmsStore.update(post.slug, { ...post, status: "published", publishedAt: post.publishedAt ?? new Date().toISOString() });
      await auditActions.record(user!.email, "cms.post.publish", `post:${post.slug}`, { after: { via: "approval" } });
    }
  }
  await auditActions.record(user!.email, `cms.publish.${body.decision}`, `post:${request.postSlug}`);
  await notificationCenter.notify(request.requestedBy, body.decision === "approved"
    ? { title: "公開申請が承認されました", body: `${request.postSlug} を公開しました`, href: `/cms`, kind: "success" }
    : { title: "公開申請が却下されました", body: body.note ? `${request.postSlug}：${body.note}` : request.postSlug, href: "/cms", kind: "warning" });
  return Response.json(decided);
}

export const POST = withApiObservability("/api/cms/publish-requests/[id]/decision", handlePOST);
