/** 管理: 通知テンプレートの取得(GET・既定+上書きの解決結果と生の上書き)・更新(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { validate, z } from "@platform/validation";

/**
 * 通知テンプレートの上書き。
 *
 * **本文と件名は利用者に届く文字列**なので、型が崩れると
 * 「[object Object]」がそのままメールで送られる。
 */
const TemplatePatch = z.record(
  z.string().min(1),
  z.record(z.string(), z.object({ title: z.string().optional(), body: z.string().optional() })),
);
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { templateStore, auditActions } from "../../../../server/platform-services";
import { resolveTemplates, type TemplateOverrides } from "../../../../server/notification-templates";

function admin(req: Request) {
  const user = currentUser(req);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  const overrides = await templateStore.get();
  return Response.json({ resolved: resolveTemplates(overrides), overrides });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  const parsed = validate(TemplatePatch, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return Response.json({ error: parsed.error.message, details: parsed.error.details }, { status: 400 });
  }
  const overrides = parsed.value as TemplateOverrides;
  await templateStore.update(overrides);
  await auditActions.record(user.email, "notificationTemplate.update", `events:${Object.keys(overrides).length}`, {});
  return Response.json({ resolved: resolveTemplates(overrides) });
}

export const GET = withApiObservability("/api/admin/notification-templates", handleGET);
export const POST = withApiObservability("/api/admin/notification-templates", handlePOST);
