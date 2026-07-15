/** カテゴリ: 一覧(GET)・作成(POST)・並べ替え(PATCH)。 */
import { validateCategoryInput, type CategoryInput } from "@platform/cms";
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { categoryStore, auditActions } from "../../../../server/platform-services.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  return Response.json({ categories: await categoryStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as CategoryInput;
  const valid = validateCategoryInput(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  const c = await categoryStore.create(valid.value);
  await auditActions.record(user!.email, "cms.category.create", `category:${c.id}`, { after: { name: c.name, slug: c.slug } });
  return Response.json(c, { status: 201 });
}

async function handlePATCH(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as { orderedIds: string[] };
  if (!Array.isArray(body.orderedIds)) return Response.json({ error: "orderedIds が必要です" }, { status: 400 });
  const categories = await categoryStore.reorder(body.orderedIds);
  await auditActions.record(user!.email, "cms.category.reorder", "category:*");
  return Response.json({ categories });
}

export const GET = withApiObservability("/api/cms/categories", handleGET);
export const POST = withApiObservability("/api/cms/categories", handlePOST);
export const PATCH = withApiObservability("/api/cms/categories", handlePATCH);
