/** CMS 記事: 一覧(GET)・作成(POST)。編集は cms:edit、公開は cms:publish。公開権限が無い場合は公開申請を作成し下書き保存。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission, userCan } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { cmsStore, auditActions, revisionStore, publishRequestStore, notificationCenter } from "../../../../server/platform-services.js";
import { validatePostInput, isPublishAction, effectiveStatus, type CmsPostInput, type PostStatus } from "../../../../server/cms-store.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const list = await cmsStore.list(status === "draft" || status === "published" ? { status: status as PostStatus } : {});
  const now = new Date();
  const posts = list.map((p) => ({ ...p, effectiveStatus: effectiveStatus(p, now) }));
  return Response.json({ posts });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as CmsPostInput;
  const valid = validatePostInput(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  if (await cmsStore.get(body.slug)) return Response.json({ error: "同じ slug の記事が既にあります" }, { status: 409 });

  // 公開しようとしているが公開権限が無い → 下書きで保存し、公開申請を作成
  let pendingPublish = false;
  if (isPublishAction(valid.value) && !userCan(user, "cms:publish")) {
    valid.value.status = "draft";
    pendingPublish = true;
  }

  const post = await cmsStore.create(valid.value);
  await revisionStore.record(post, user!.email);
  await auditActions.record(user!.email, "cms.post.create", `post:${post.slug}`, { after: { title: post.title, status: post.status } });

  if (pendingPublish) {
    const request = await publishRequestStore.request(post.slug, user!.email);
    await auditActions.record(user!.email, "cms.publish.request", `post:${post.slug}`);
    await notificationCenter.notify("cms-approvers", { title: "公開申請があります", body: `${post.title}（${user!.email}）`, href: "/cms/publish-requests", kind: "info" });
    await notificationCenter.notify(user!.email, { title: "公開申請を送信しました", body: `${post.title}（承認待ち）`, href: "/cms", kind: "info" });
    return Response.json({ ...post, publishRequest: request }, { status: 201 });
  }
  return Response.json(post, { status: 201 });
}

export const GET = withApiObservability("/api/cms/posts", handleGET);
export const POST = withApiObservability("/api/cms/posts", handlePOST);
