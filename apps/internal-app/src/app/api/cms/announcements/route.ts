/** お知らせ: 一覧(GET)・作成(POST)。 */
import { validateAnnouncementInput, type AnnouncementInput } from "@platform/cms";
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { announcementStore, auditActions } from "../../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:read");
  return Response.json({ announcements: await announcementStore.list() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "cms:edit");
  const body = (await req.json()) as AnnouncementInput;
  const valid = validateAnnouncementInput(body);
  if (!valid.ok) return Response.json({ error: valid.error }, { status: 400 });
  const a = await announcementStore.create(valid.value);
  await auditActions.record(user!.email, "cms.announcement.create", `announcement:${a.id}`, { after: { message: a.message } });
  return Response.json(a, { status: 201 });
}

export const GET = withApiObservability("/api/cms/announcements", handleGET);
export const POST = withApiObservability("/api/cms/announcements", handlePOST);
