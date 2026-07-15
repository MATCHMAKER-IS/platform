/**
 * 統合ステータス。DB・外部連携・メール等の依存の稼働状況を集約する。基盤 @platform/observability の runHealthChecks を使う。
 * @packageDocumentation
 */
import { runHealthChecks, type HealthCheck, type HealthReport } from "@platform/observability";

/** 依存チェックの集合を作る。各値は失敗時に throw する関数。 */
export interface StatusDeps {
  checkDb: HealthCheck;
  checkMail?: HealthCheck;
  checkZoho?: HealthCheck;
  checkWebhooks?: HealthCheck;
}

/** 依存からチェック群を組み立てる（未指定のものは除外）。 */
export function buildStatusChecks(deps: StatusDeps): Record<string, HealthCheck> {
  const checks: Record<string, HealthCheck> = { database: deps.checkDb };
  if (deps.checkMail) checks.mail = deps.checkMail;
  if (deps.checkZoho) checks.zoho = deps.checkZoho;
  if (deps.checkWebhooks) checks.webhooks = deps.checkWebhooks;
  return checks;
}

/** ステータスを取得する（タイムアウト付き）。 */
export async function getStatus(deps: StatusDeps, timeoutMs = 2000): Promise<HealthReport> {
  return runHealthChecks(buildStatusChecks(deps), { timeoutMs });
}

/** レポートを表示用に要約する（up/down 件数）。 */
export function summarizeStatus(report: HealthReport): { healthy: boolean; up: number; down: number; total: number } {
  const up = report.checks.filter((c) => c.status === "up").length;
  const down = report.checks.filter((c) => c.status === "down").length;
  return { healthy: report.status === "healthy", up, down, total: report.checks.length };
}
