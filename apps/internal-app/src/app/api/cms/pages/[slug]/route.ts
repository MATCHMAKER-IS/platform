/** 固定ページ: 取得(GET)・更新(PUT)・削除(DELETE)。 */
import { validatePageInput, type PageInput } from "@platform/cms";
import { withApiObservability } from "../../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../../server/authorize.js";
import { serverEnv } from "../../../../../server/env.js";
import { pageStore, auditActions } from "../../../../../server/platform-services.js";

async function handleGET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  const page = await pageStore.get(slug);
  if (!page) return Response.json({ error: "ページが見つかりません" }, { status: 404 });
  return Response.json(page);
}

async function handlePUT(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as PageInput;
  const valid = validatePageInput(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  const page = await pageStore.update(slug, valid.value);
  if (!page) return Response.json({ error: "ページが見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "cms.page.update", `page:${slug}`, { after: { title: page.title, status: page.status } });
  return Response.json(page);
}

async function handleDELETE(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const removed = await pageStore.remove(slug);
  if (!removed) return Response.json({ error: "ページが見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "cms.page.delete", `page:${slug}`);
  return Response.json({ ok: true });
}

export const GET = withApiObservability("/api/cms/pages/[slug]", handleGET);
export const PUT = withApiObservability("/api/cms/pages/[slug]", handlePUT);
export const DELETE = withApiObservability("/api/cms/pages/[slug]", handleDELETE);
