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
import { createAlertManager, errorRateAbove, avgLatencyAbove, type Alert, type MetricsView, type AlertRule } from "@platform/observability";
import { metrics } from "./observability";
import { log, mailer } from "./services";
import { featureEnv } from "./env";

/**
 * ルール。**しきい値は ADR 0012(性能基準)に合わせている**。
 * - エラー率 0% が絶対の線 → 1% 超で critical
 * - 一覧の p95 目標 300ms → 平均 500ms 超が続くなら warning
 */
// **型注釈を付ける。** 2026-08 に `describe` を `message` と書き誤り、
// **評価器が実行時に落ちる**状態のまま気づけなかった
// ——`AlertRule[]` と書いてあれば型検査で止まる。
//
// **静的な検査(文字列が含まれるか)は通っていた**のも見落としの原因。
// ルールは**実際に評価器へ通して**確かめること(smoke に追加済み)。
const RULES: AlertRule[] = [
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
    name: "outbox_exhausted",
    severity: "critical" as const,
    // **再試行を使い切った通知がある。** 2026-08 まで `log.warn` だけで、
    // **見る人がいなければ気づけなかった**——経費の承認通知が届かないと、
    // 申請者は「まだ承認されない」、承認者は「依頼が来ていない」と思ったまま
    // **承認が止まる**。1 件でも起きたら知らせる(件数が少ないほど原因を追いやすい)
    condition: (view: { counters: Record<string, number> }) =>
      Object.entries(view.counters)
        .filter(([k]) => k.startsWith("outbox.exhausted"))
        .reduce((a, [, v]) => a + v, 0) > 0,
    describe: () => "通知の再試行が上限に達しました。届いていない通知があります",
  },
  {
    name: "cron_failed",
    severity: "critical" as const,
    // **定期実行が失敗している。** メトリクスには載っていた
    // (`cron_runs_total{outcome:"error"}`)が、**アラートが無く誰も見ていなかった**。
    //
    // 通知リレーが止まると **Outbox が溜まり続け**、やがて再試行を使い切って
    // `outbox_exhausted` になる——**そこまで進む前に気づきたい**。
    // 定期実行は「動いていて当たり前」なので、**止まっても誰も報告してこない**。
    condition: (view: { counters: Record<string, number> }) =>
      Object.entries(view.counters)
        .filter(([k]) => k.startsWith("cron_runs_total") && k.includes("error"))
        .reduce((a, [, v]) => a + v, 0) > 0,
    describe: () => "定期実行が失敗しました。通知やレポートが止まっている可能性があります",
  },
  {
    name: "audit_write_failed",
    severity: "critical" as const,
    // **監査ログの記録に失敗した。** 「誰がいつログインしたか」を後から追えなくなる。
    //
    // **欠けたこと自体が記録に残らない**のが問題で、監査のときに
    // **「記録が無い＝ログインしていない」と誤読される**——
    // 実際には「記録できなかっただけ」かもしれない。
    // 1 件でも起きたら知らせる。
    condition: (view: { counters: Record<string, number> }) =>
      Object.entries(view.counters)
        .filter(([k]) => k.startsWith("audit.write_failed"))
        .reduce((a, [, v]) => a + v, 0) > 0,
    describe: () => "監査ログの記録に失敗しました。追跡できない操作があります",
  },
  {
    name: "http_latency",
    severity: "warning" as const,
    forEvaluations: 3,
    // **ADR 0012 の目標は「p95 300ms」だが、ここは「平均 500ms」を見ている。**
    // **平均と p95 は別物**——平均が 500ms 以下でも、
    // **一部の利用者だけが 2 秒待たされている**ことはありうる。
    //
    // p95 を出す材料はある(`metrics.snapshot().histograms` に
    // `buckets` / `sum` / `count`)ので、**測るなら自前で計算する**。
    // 今は平均で「明らかに遅い」だけを拾っている(2026-08 に確認)。
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
        // **メソッド名は `sendMail`。** 失敗は例外ではなく Result で返る
        await mailer.sendMail({ to: addr, subject: sub, text });
      });
      await send(to, subject, body + footer);
      sent.push("mail");
    } catch (e) {
      failed.push({ channel: "mail", reason: e instanceof Error ? e.message : String(e) });
    }
  }

  if (slack) {
    try {
      // no-ssrf-check: 送信先は Slack の Webhook URL(環境変数で設定する固定値)。利用者は指定できない
      const post = deps?.postSlack ?? (async (url: string, text: string) => {
        // **時間を切る。**
        // 相手が応答しないと、アラート送信でこちらが止まる。
        // 「異常を知らせる仕組みが異常で詰まる」のが最悪(2026-08)
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
          signal: AbortSignal.timeout(5000),
          // **リダイレクトを追わない。** 通知先が差し替えられたとき、
          // 障害の内容(内部の状態)が別の場所へ送られる
          redirect: "manual",
        });
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
