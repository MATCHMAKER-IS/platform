/**
 * 管理: 監査アラートの定期スキャン(POST)。cron 等から定期実行する想定。
 * 異常を検出し、重複を抑制した上で、受信箱＋Slack＋Webhook へ通知する。
 * X-Cron-Token(env CRON_TOKEN)一致、または管理者セッションで実行可。
 * 推奨頻度・他の scan API との一覧は `docs/ops/CRON_JOBS.md` を参照。
 */
import { withApiObservability } from "../../../../../server/instrument";
import { isCronAuthorized } from "../../../../../server/cron-auth";
import { auditLog, userStore, appMailer, settingsStore, alertSeenStore, auditActions } from "../../../../../server/platform-services";
import { detectAnomalies, anomalyDigest, type AuditEvent } from "../../../../../server/audit-anomaly";
import { buildAlertChannels, notifyNewAnomalies } from "../../../../../server/alert-notify";
import { createNotifier, type NotifyChannel, type NotifyMessage } from "@platform/notify";

/** 抑制の時間窓（既定 6 時間）。 */
const TTL_MS = 6 * 60 * 60 * 1000;


async function handlePOST(req: Request): Promise<Response> {
  if (!(isCronAuthorized(req))) return Response.json({ error: "権限がありません" }, { status: 403 });
  const rows = await auditLog.query({ limit: 1000 });
  const events: AuditEvent[] = rows.map((r) => ({ actor: r.actor, action: r.action, target: r.target, at: r.at }));
  const anomalies = detectAnomalies(events);

  // 受信箱チャネル: 有効な管理者へ配送
  const admins = (await userStore.list()).filter((u) => u.active && u.roles.includes("admin")).map((u) => u.email);
  const mailChannel: NotifyChannel | undefined = admins.length > 0 ? {
    async send(m: NotifyMessage) {
      // **1 件ずつ送る。** `to` に配列を渡すと受信者全員に他の管理者の
      // メールアドレスが見える(2026-08、他の通知経路と同じ穴を発見して修正)。
      for (const to of admins) {
        await appMailer.sendMail({ to, from: "system@example.com", subject: `[監査アラート] ${m.level === "error" ? "重大" : "警告"}`, text: m.text });
      }
    },
  } : undefined;
  const settings = await settingsStore.get();
  const channels = buildAlertChannels({ mailChannel, slackWebhook: settings.alertSlackWebhook || undefined, webhookUrl: settings.alertWebhookUrl || undefined });
  const notifier = createNotifier(channels);

  const { notified, skipped } = await notifyNewAnomalies(notifier, alertSeenStore, anomalies, TTL_MS);
  if (notified.length > 0) await auditActions.record("system", "audit.alerts.scan", `notified:${notified.length}`, { after: { detected: anomalies.length, notified: notified.length, skipped, channels: channels.length } });
  return Response.json({ detected: anomalies.length, notified: notified.length, suppressed: skipped, channels: channels.length, digest: anomalyDigest(anomalies) });
}

export const POST = withApiObservability("/api/admin/audit-alerts/scan", handlePOST);
