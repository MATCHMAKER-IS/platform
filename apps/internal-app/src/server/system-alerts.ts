/**
 * システムアラートの評価と通知(エラー率・レイテンシなど、基盤の異常)。
 *
 * 業務のアラート(売掛の期限超過など)は `alerts.ts` の担当。こちらはシステムの健康状態。
 *
 * `@platform/observability` の AlertManager は「評価して状態変化を返す」だけの純ロジック。
 * ここで「どのルールを使うか」「どこへ通知するか」というアプリ固有の判断を配線する。
 * 呼び出しは cron から(`/api/admin/system-alerts/scan`)。
 * @packageDocumentation
 */
import { createAlertManager, errorRateAbove, avgLatencyAbove, type Alert, type MetricsView } from "@platform/observability";
import { metrics } from "./observability";
import { log, mailer } from "./services";
import { featureEnv } from "./env";

/**
 * ルール。**しきい値は ADR 0012(性能基準)に合わせている**。
 * - エラー率 0% が絶対の線 → 1% 超で critical
 * - 一覧の p95 目標 300ms → 平均 500ms 超が続くなら warning
 */
const RULES = [
  {
    name: "http_error_rate",
    severity: "critical" as const,
    forEvaluations: 2, // 2 回連続で異常なら発報(一時的なスパイクで騒がない)
    condition: errorRateAbove("http_requests_total", "http_errors_total", 0.01),
    describe: (m: MetricsView) => {
      const total = m.counters["http_requests_total"] ?? 0;
      const errors = m.counters["http_errors_total"] ?? 0;
      const rate = total === 0 ? 0 : (errors / total) * 100;
      return `エラー率が ${rate.toFixed(1)}%(${errors}/${total})。ADR 0012 では 0% が基準です`;
    },
  },
  {
    name: "http_latency",
    severity: "warning" as const,
    forEvaluations: 3,
    condition: avgLatencyAbove("http_request_duration_ms", 500),
    describe: () => "API の平均応答が 500ms を超えています(一覧の目標は p95 300ms)",
  },
];

/** アプリで 1 つだけ持つ(発報状態を保つため)。 */
const manager = createAlertManager(RULES);

/** 通知の実行結果。 */
export interface SystemAlertResult {
  /** 状態が変化したアラート(発報 or 回復)。 */
  changes: Alert[];
  /** 送信できた宛先。 */
  sent: string[];
  /** 送信に失敗した宛先と理由。 */
  failed: { channel: string; reason: string }[];
}

/** アラート 1 件を人が読める文面にする。 */
export function formatSystemAlert(alert: Alert): string {
  const mark = alert.firing ? (alert.severity === "critical" ? "🔴" : "🟡") : "✅";
  return `${mark} [${alert.firing ? "発生" : "回復"}] ${alert.name}\n${alert.message}`;
}

/**
 * 現在のメトリクスを評価し、**状態が変わったときだけ**通知する
 * (発報中ずっと鳴り続けると、やがて誰も見なくなるため)。
 *
 * @param deps テスト用の差し替え
 */
export async function evaluateAndNotify(deps?: {
  view?: MetricsView;
  mailTo?: string;
  slackWebhook?: string;
  sendMail?: (to: string, subject: string, text: string) => Promise<void>;
  postSlack?: (url: string, text: string) => Promise<void>;
}): Promise<SystemAlertResult> {
  const view = deps?.view ?? metrics.snapshot();
  const changes = manager.evaluate(view);
  const sent: string[] = [];
  const failed: { channel: string; reason: string }[] = [];
  if (changes.length === 0) return { changes, sent, failed };

  const to = deps?.mailTo ?? featureEnv.ALERT_MAIL_TO;
  const slack = deps?.slackWebhook ?? featureEnv.ALERT_SLACK_WEBHOOK;
  const body = changes.map(formatSystemAlert).join("\n\n");
  const critical = changes.some((c) => c.firing && c.severity === "critical");
  const subject = `${critical ? "【緊急】" : "【注意】"}社内アプリのアラート(${changes.length} 件)`;
  const footer = "\n\n運用ダッシュボード: /admin/ops\n対応手順: docs/ops/INCIDENT_RESPONSE.md";

  if (to) {
    try {
      const send = deps?.sendMail ?? (async (addr: string, sub: string, text: string) => {
        await mailer.send({ to: addr, subject: sub, text });
      });
      await send(to, subject, body + footer);
      sent.push("mail");
    } catch (e) {
      failed.push({ channel: "mail", reason: e instanceof Error ? e.message : String(e) });
    }
  }

  if (slack) {
    try {
      const post = deps?.postSlack ?? (async (url: string, text: string) => {
        const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
        if (!res.ok) throw new Error(`Slack が ${res.status} を返しました`);
      });
      await post(slack, `${subject}\n${body}`);
      sent.push("slack");
    } catch (e) {
      failed.push({ channel: "slack", reason: e instanceof Error ? e.message : String(e) });
    }
  }

  // 通知先が無いときも、せめてログに残す(気づけないより良い)
  if (sent.length === 0 && failed.length === 0) {
    log.warn({ alerts: changes.map((c) => c.name) }, `アラートが発生しましたが通知先が未設定です: ${body}`);
  }
  for (const f of failed) log.error({ channel: f.channel, reason: f.reason }, "アラート通知に失敗しました");

  return { changes, sent, failed };
}

/** 現在発報中のアラート(運用ダッシュボード用)。 */
export function activeSystemAlerts(): Alert[] {
  return manager.active();
}
