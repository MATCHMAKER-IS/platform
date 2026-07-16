/** お知らせ: 更新(PUT)・削除(DELETE)。 */
import { validateAnnouncementInput, type AnnouncementInput } from "@platform/cms";
import { withApiObservability } from "../../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { announcementStore, auditActions } from "../../../../../server/platform-services";

async function handlePUT(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as AnnouncementInput;
  const valid = validateAnnouncementInput(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  const a = await announcementStore.update(id, valid.value);
  if (!a) return Response.json({ error: "お知らせが見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "cms.announcement.update", `announcement:${id}`, { after: { message: a.message } });
  return Response.json(a);
}

async function handleDELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const removed = await announcementStore.remove(id);
  if (!removed) return Response.json({ error: "お知らせが見つかりません" }, { status: 404 });
  await auditActions.record(user!.email, "cms.announcement.delete", `announcement:${id}`);
  return Response.json({ ok: true });
}

export const PUT = withApiObservability("/api/cms/announcements/[id]", handlePUT);
export const DELETE = withApiObservability("/api/cms/announcements/[id]", handleDELETE);
