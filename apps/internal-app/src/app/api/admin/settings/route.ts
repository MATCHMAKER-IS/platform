/** 管理: システム設定 取得(GET)・更新(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { settingsStore, auditActions } from "../../../../server/platform-services.js";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  return Response.json({ settings: await settingsStore.get() });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const patch = (await req.json()) as Record<string, string>;
  const settings = await settingsStore.update(patch);
  await auditActions.record(user.email, "settings.update", "system", { after: settings as unknown as Record<string, unknown> });
  return Response.json({ settings });
}

export const GET = withApiObservability("/api/admin/settings", handleGET);
export const POST = withApiObservability("/api/admin/settings", handlePOST);
