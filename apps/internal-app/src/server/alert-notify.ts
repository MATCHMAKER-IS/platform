/**
 * 監査アラートの通知配信。複数チャネル（受信箱・Slack・Webhook 等）へファンアウトし、同一異常の再通知を抑制する。
 * 基盤 @platform/notify のチャネル／重複抑制（SeenStore）を利用する。
 * @packageDocumentation
 */
import { createSlackChannel, createWebhookChannel, type NotifyChannel, type NotifyMessage, type Notifier, type SeenStore } from "@platform/notify";
import { type Anomaly } from "./audit-anomaly";

/** 異常の重複判定キー（種別＋対象者）。 */
export function anomalyKey(a: Anomaly): string {
  return `${a.kind}:${a.actor}`;
}

/** 異常を通知メッセージに変換する（重大→error, 警告→warn）。 */
export function anomalyMessage(a: Anomaly): NotifyMessage {
  return { text: `${a.title}: ${a.detail}`, level: a.level === "critical" ? "error" : "warn" };
}

/** 設定に応じてチャネルを組み立てる（受信箱チャネルは呼び出し側から渡す）。 */
export function buildAlertChannels(opts: { mailChannel?: NotifyChannel; slackWebhook?: string; webhookUrl?: string }): NotifyChannel[] {
  const channels: NotifyChannel[] = [];
  if (opts.mailChannel) channels.push(opts.mailChannel);
  if (opts.slackWebhook) channels.push(createSlackChannel(opts.slackWebhook));
  if (opts.webhookUrl) channels.push(createWebhookChannel(opts.webhookUrl));
  return channels;
}

/**
 * 未通知の異常だけを通知する（同一キーが TTL 内なら抑制）。既に通知済みの異常はスキップ。
 * @returns 通知した異常キーの一覧と、抑制した件数。
 */
export async function notifyNewAnomalies(notifier: Notifier, seen: SeenStore, anomalies: Anomaly[], ttlMs: number): Promise<{ notified: string[]; skipped: number }> {
  const notified: string[] = [];
  let skipped = 0;
  for (const a of anomalies) {
    const key = anomalyKey(a);
    // markSeen: 既出(TTL内)なら true → 抑制。初出なら記録して通知。
    if (seen.markSeen(key, ttlMs)) {
      skipped += 1;
      continue;
    }
    await notifier.notify(anomalyMessage(a));
    notified.push(key);
  }
  return { notified, skipped };
}
