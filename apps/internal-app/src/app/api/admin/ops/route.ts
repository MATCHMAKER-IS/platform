/**
 * 運用ダッシュボード用の集約 API。障害時に「まずここを見る」ための 1 本。
 *
 * 個別の API(/api/status, /api/admin/health, /api/metrics)は既にあるが、
 * 障害対応中に何本も叩くのは現実的でない。**1 リクエストで全体像が分かる**ようにする。
 * 管理者のみ。
 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser } from "../../../../server/authorize";
import { serverEnv, featureEnv, env } from "../../../../server/env";
import { metrics } from "../../../../server/observability";
import { db } from "../../../../server/services";
import { sql, queryRaw } from "@platform/db";
import { zohoBreakerState } from "../../../../server/zoho-client";
import { webhookSubscriptionStore, auditLog } from "../../../../server/platform-services";
import { buildStatusChecks, summarizeStatus } from "../../../../server/status-checks";
import { runHealthChecks } from "@platform/observability";
import { maskSecrets } from "@platform/env";

/** ダッシュボードの 1 セクション。 */
export interface OpsSection {
  /** 表示名。 */
  name: string;
  /** 正常か。 */
  ok: boolean;
  /** 補足(異常時の手がかり)。 */
  detail?: string;
}

/** 主要な指標(数字で見る)。 */
export interface OpsMetric {
  name: string;
  value: string;
  /** 注意が必要か(しきい値超え等)。 */
  warn?: boolean;
}

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  if (!user || !user.roles.includes("admin")) {
    return Response.json({ error: "管理者権限が必要です" }, { status: 403 });
  }

  // 1) 稼働状況(DB・外部連携・Webhook)
  const checks = buildStatusChecks({
    db: { query: async () => queryRaw(db, sql`SELECT 1`) },
    zohoBreaker: zohoBreakerState,
    webhookStore: webhookSubscriptionStore,
  });
  const report = await runHealthChecks(checks, 2000);
  const summary = summarizeStatus(report);
  const sections: OpsSection[] = Object.entries(report.checks).map(([name, c]) => ({
    name,
    ok: c.ok,
    ...(c.detail ? { detail: c.detail } : {}),
  }));

  // 2) 監査ログの整合性(改ざん検知)
  let auditOk = true;
  let auditDetail: string | undefined;
  try {
    const v = await auditLog.verify();
    auditOk = v.valid;
    if (!v.valid) auditDetail = "改ざんの疑いがあります。至急確認してください";
  } catch (e) {
    auditOk = false;
    auditDetail = e instanceof Error ? e.message : "検証に失敗";
  }
  sections.push({ name: "監査ログの整合性", ok: auditOk, ...(auditDetail ? { detail: auditDetail } : {}) });

  // 3) 主要な指標(メトリクスから)
  const snapshot = metrics.snapshot();
  const counters = snapshot.counters ?? {};
  const totalReq = Object.entries(counters)
    .filter(([k]) => k.startsWith("http_requests_total"))
    .reduce((a, [, v]) => a + (typeof v === "number" ? v : 0), 0);
  const errReq = Object.entries(counters)
    .filter(([k]) => k.startsWith("http_requests_total") && /status="5/.test(k))
    .reduce((a, [, v]) => a + (typeof v === "number" ? v : 0), 0);
  const errorRate = totalReq === 0 ? 0 : errReq / totalReq;

  const opsMetrics: OpsMetric[] = [
    { name: "リクエスト総数", value: String(totalReq) },
    { name: "5xx エラー", value: String(errReq), warn: errReq > 0 },
    { name: "エラー率", value: `${(errorRate * 100).toFixed(2)}%`, warn: errorRate > 0 },
    { name: "起動からの経過", value: `${Math.round(process.uptime() / 60)} 分` },
    { name: "メモリ使用", value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB` },
  ];

  // 4) 設定の要点(障害時に「設定漏れでは?」を即確認する)
  const configHints = maskSecrets({
    NODE_ENV: (env as { NODE_ENV?: string }).NODE_ENV ?? "",
    DATABASE_URL: serverEnv.DATABASE_URL ? "設定済み" : "",
    SESSION_SECRET: serverEnv.SESSION_SECRET,
    ANTHROPIC_API_KEY: featureEnv.ANTHROPIC_API_KEY,
    CRON_TOKEN: featureEnv.CRON_TOKEN,
  });

  const healthy = summary.healthy && auditOk && errReq === 0;

  return Response.json({
    healthy,
    summary: { up: summary.up, down: summary.down, total: summary.total },
    sections,
    metrics: opsMetrics,
    config: configHints,
    checkedAt: new Date().toISOString(),
  });
}

export const GET = withApiObservability("/api/admin/ops", handleGET);
