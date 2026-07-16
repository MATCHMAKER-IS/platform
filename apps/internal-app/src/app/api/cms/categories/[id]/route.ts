/** カテゴリ: 更新(PUT)・削除(DELETE)。 */
import { validateCategoryInput, type CategoryInput } from "@platform/cms";
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { categoryStore, auditActions } from "../../../../../server/platform-services";

async function handlePUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as CategoryInput;
  const valid = validateCategoryInput(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  const c = await categoryStore.update(id, valid.value);
  if (!c) return Response.json({ error: "カテゴリが見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "cms.category.update", `category:${id}`, { after: { name: c.name, slug: c.slug } });
  return Response.json(c);
}

async function handleDELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const removed = await categoryStore.remove(id);
  if (!removed) return Response.json({ error: "カテゴリが見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "cms.category.delete", `category:${id}`);
  return Response.json({ ok: true });
}

export const PUT = withApiObservability("/api/cms/categories/[id]", handlePUT);
export const DELETE = withApiObservability("/api/cms/categories/[id]", handleDELETE);
