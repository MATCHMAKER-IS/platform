/** 管理: 送信Webhook購読の一覧(GET)・追加/有効切替/削除(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { webhookSubscriptionStore, auditActions } from "../../../../server/platform-services.js";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const subs = await webhookSubscriptionStore.list();
  return Response.json({ subscriptions: subs.map((s) => ({ id: s.id, url: s.url, events: s.events, active: s.active, createdAt: s.createdAt })) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const body = (await req.json()) as { op?: string; url?: string; events?: string[]; secret?: string; id?: string; active?: boolean };
  if (body.op === "add") {
    if (!body.url || !Array.isArray(body.events) || body.events.length === 0 || !body.secret) return Response.json({ error: "url・events・secret が必要です" }, { status: 400 });
    const sub = await webhookSubscriptionStore.add({ url: body.url, events: body.events, secret: body.secret });
    await auditActions.record(user.email, "webhook.subscribe", `webhook:${sub.id}`, { after: { events: body.events } });
    return Response.json({ id: sub.id }, { status: 201 });
  }
  if (body.op === "setActive" && body.id && typeof body.active === "boolean") {
    await webhookSubscriptionStore.setActive(body.id, body.active);
    return Response.json({ id: body.id, active: body.active });
  }
  if (body.op === "remove" && body.id) {
    await webhookSubscriptionStore.remove(body.id);
    await auditActions.record(user.email, "webhook.unsubscribe", `webhook:${body.id}`, {});
    return Response.json({ id: body.id, removed: true });
  }
  return Response.json({ error: "不正な操作です" }, { status: 400 });
}

export const GET = withApiObservability("/api/admin/webhooks", handleGET);
export const POST = withApiObservability("/api/admin/webhooks", handlePOST);
