/** CMS 記事: 取得(GET)・更新(PUT)・削除(DELETE)。 */
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission, userCan } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { cmsStore, auditActions, revisionStore, publishRequestStore, notificationCenter } from "../../../../../server/platform-services";
import { validatePostInput, isPublishAction, type CmsPostInput } from "../../../../../server/cms-store";

async function handleGET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  const post = await cmsStore.get(slug);
  if (!post) return Response.json({ error: "記事が見つかりません" }, { status: 404 });
  return Response.json(post);
}

async function handlePUT(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as CmsPostInput;
  const valid = validatePostInput(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  const before = await cmsStore.get(slug);

  // 公開しようとしているが公開権限が無い → 下書きのまま保存し、公開申請を作成
  let pendingPublish = false;
  if (isPublishAction(valid.value) && !userCan(user, "cms:publish")) {
    valid.value.status = "draft";
    pendingPublish = true;
  }

  const post = await cmsStore.update(slug, valid.value);
  if (!post) return Response.json({ error: "記事が見つかりません" }, { status: 404 });
  await revisionStore.record(post, user!.email);
  await auditActions.record(user!.email, "cms.post.update", `post:${slug}`, { before: before ? { title: before.title, status: before.status } : undefined, after: { title: post.title, status: post.status } });

  if (pendingPublish) {
    const request = await publishRequestStore.request(post.slug, user!.email);
    await auditActions.record(user!.email, "cms.publish.request", `post:${post.slug}`);
    await notificationCenter.notify("cms-approvers", { title: "公開申請があります", body: `${post.title}（${user!.email}）`, href: "/cms/publish-requests", kind: "info" });
    await notificationCenter.notify(user!.email, { title: "公開申請を送信しました", body: `${post.title}（承認待ち）`, href: "/cms", kind: "info" });
    return Response.json({ ...post, publishRequest: request });
  }
  return Response.json(post);
}

async function handleDELETE(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const removed = await cmsStore.remove(slug);
  if (!removed) return Response.json({ error: "記事が見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "cms.post.delete", `post:${slug}`);
  return Response.json({ ok: true });
}

export const GET = withApiObservability("/api/cms/posts/[slug]", handleGET);
export const PUT = withApiObservability("/api/cms/posts/[slug]", handlePUT);
export const DELETE = withApiObservability("/api/cms/posts/[slug]", handleDELETE);
