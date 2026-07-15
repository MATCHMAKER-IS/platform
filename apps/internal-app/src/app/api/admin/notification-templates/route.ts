/** 管理: 通知テンプレートの取得(GET・既定+上書きの解決結果と生の上書き)・更新(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { templateStore, auditActions } from "../../../../server/platform-services.js";
import { resolveTemplates, type TemplateOverrides } from "../../../../server/notification-templates.js";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const overrides = await templateStore.get();
  return Response.json({ resolved: resolveTemplates(overrides), overrides });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const overrides = (await req.json()) as TemplateOverrides;
  await templateStore.update(overrides);
  await auditActions.record(user.email, "notificationTemplate.update", `events:${Object.keys(overrides).length}`, {});
  return Response.json({ resolved: resolveTemplates(overrides) });
}

export const GET = withApiObservability("/api/admin/notification-templates", handleGET);
export const POST = withApiObservability("/api/admin/notification-templates", handlePOST);
