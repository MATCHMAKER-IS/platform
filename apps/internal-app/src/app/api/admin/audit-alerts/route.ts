/** 管理: 監査アラート。異常検知(GET)と、管理者受信箱への通知配信(POST)。管理者のみ。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import "../../../../server/env";
import { auditLog, userStore, appMailer, auditActions } from "../../../../server/platform-services";
import { detectAnomalies, anomalyDigest, type AuditEvent } from "../../../../server/audit-anomaly";

function admin(req: Request) {
  const user = currentUser(req);
  return user && user.roles.includes("admin") ? user : null;
}

async function events(): Promise<AuditEvent[]> {
  const rows = await auditLog.query({ limit: 1000 });
  return rows.map((r) => ({ actor: r.actor, action: r.action, target: r.target, at: r.at }));
}

async function handleGET(req: Request): Promise<Response> {
  if (!admin(req)) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  return Response.json({ anomalies: detectAnomalies(await events()) });
}

async function handlePOST(req: Request): Promise<Response> {
  const user = admin(req);
  if (!user) return Response.json({ error: "管理者権限が必要です。必要な場合は管理者に依頼してください" }, { status: 403 });
  const anomalies = detectAnomalies(await events());
  if (anomalies.length === 0) return Response.json({ dispatched: 0, anomalies: 0 });
  const admins = (await userStore.list()).filter((u) => u.active && u.roles.includes("admin")).map((u) => u.email);
  // **1 件ずつ送る。** `to` に配列を渡すと受信者全員に他の管理者の
  // メールアドレスが見える(2026-08、他の通知経路と同じ穴を発見して修正)。
  for (const to of admins) {
    await appMailer.sendMail({ to, from: "system@example.com", subject: `[監査アラート] ${anomalies.length} 件の異常を検出`, text: anomalyDigest(anomalies) });
  }
  await auditActions.record(user.email, "audit.alerts.dispatch", `count:${anomalies.length}`, { after: { anomalies: anomalies.length, admins: admins.length } });
  return Response.json({ dispatched: admins.length, anomalies: anomalies.length });
}

export const GET = withApiObservability("/api/admin/audit-alerts", handleGET);
export const POST = withApiObservability("/api/admin/audit-alerts", handlePOST);
