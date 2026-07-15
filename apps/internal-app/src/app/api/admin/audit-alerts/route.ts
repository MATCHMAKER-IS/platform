/** 管理: 監査アラート。異常検知(GET)と、管理者受信箱への通知配信(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { auditLog, userStore, appMailer, auditActions } from "../../../../server/platform-services.js";
import { detectAnomalies, anomalyDigest, type AuditEvent } from "../../../../server/audit-anomaly.js";

function admin(req: Request) {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return user && user.roles.includes("admin") ? user : null;
}

async function events(): Promise<AuditEvent[]> {
  const rows = await auditLog.query({ limit: 1000 });
  return rows.map((r) => ({ actor: r.actor, action: r.action, target: r.target, at: r.at }));
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  return Response.json({ anomalies: detectAnomalies(await events()) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  const anomalies = detectAnomalies(await events());
  if (anomalies.length === 0) return Response.json({ dispatched: 0, anomalies: 0 });
  const admins = (await userStore.list()).filter((u) => u.active && u.roles.includes("admin")).map((u) => u.email);
  if (admins.length > 0) await appMailer.sendMail({ to: admins, from: "system@example.com", subject: `[監査アラート] ${anomalies.length} 件の異常を検出`, text: anomalyDigest(anomalies) });
  await auditActions.record(user.email, "audit.alerts.dispatch", `count:${anomalies.length}`, { after: { anomalies: anomalies.length, admins: admins.length } });
  return Response.json({ dispatched: admins.length, anomalies: anomalies.length });
}

export const GET = withApiObservability("/api/admin/audit-alerts", handleGET);
export const POST = withApiObservability("/api/admin/audit-alerts", handlePOST);
