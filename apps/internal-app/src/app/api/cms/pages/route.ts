/** 固定ページ: 一覧(GET)・作成(POST)。 */
import { validatePageInput, type PageInput, type PageStatus } from "@platform/cms";
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { pageStore, auditActions } from "../../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  const status = new URL(req.url).searchParams.get("status");
  const pages = await pageStore.list(status === "draft" || status === "published" ? { status: status as PageStatus } : {});
  return Response.json({ pages });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as PageInput;
  const valid = validatePageInput(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  if (await pageStore.get(body.slug)) return Response.json({ error: "同じ slug のページが既にあります" }, { status: 409 });
  const page = await pageStore.create(valid.value);
  await auditActions.record(user!.email, "cms.page.create", `page:${page.slug}`, { after: { title: page.title, status: page.status } });
  return Response.json(page, { status: 201 });
}

export const GET = withApiObservability("/api/cms/pages", handleGET);
export const POST = withApiObservability("/api/cms/pages", handlePOST);
