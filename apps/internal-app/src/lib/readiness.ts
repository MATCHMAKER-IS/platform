/**
 * 起動時・稼働中のレディネス集約(純ロジック)。DB 接続・マイグレーション適用・外部依存などの
 * 個別チェックを集約し、全体の可否を返す。本番の /health(readiness)やデプロイの健全性確認に使う。
 * 各チェックの実体(プローブ)は注入し、テスト可能に保つ。
 * @packageDocumentation
 */

/** 1 件のチェック。 */
export interface ReadinessCheck {
  name: string;
  /** 実行すると ok と詳細を返す。例外は not-ready 扱い。 */
  probe: () => Promise<{ ok: boolean; detail?: string }>;
  /** 必須(false なら失敗しても全体は ready のまま。degraded として記録)。既定 true。 */
  critical?: boolean;
}

/** 1 件の結果。 */
export interface CheckResult {
  name: string;
  status: "ok" | "failed";
  critical: boolean;
  detail?: string;
}

/** 集約結果。 */
export interface ReadinessResult {
  /** 必須チェックがすべて ok なら true。 */
  ready: boolean;
  /** 一部の非必須が落ちている(稼働は継続可)。 */
  degraded: boolean;
  checks: CheckResult[];
}

/** すべてのチェックを実行して集約する。 */
export async function checkReadiness(checks: ReadinessCheck[]): Promise<ReadinessResult> {
  const results: CheckResult[] = await Promise.all(
    checks.map(async (c) => {
      const critical = c.critical !== false;
      try {
        const r = await c.probe();
        return { name: c.name, status: r.ok ? "ok" : "failed", critical, detail: r.detail } as CheckResult;
      } catch (e) {
        return { name: c.name, status: "failed", critical, detail: e instanceof Error ? e.message : String(e) } as CheckResult;
      }
    }),
  );
  const criticalFailed = results.some((r) => r.status === "failed" && r.critical);
  const nonCriticalFailed = results.some((r) => r.status === "failed" && !r.critical);
  return { ready: !criticalFailed, degraded: !criticalFailed && nonCriticalFailed, checks: results };
}

/** 集約結果を HTTP ステータスに対応づける(ready=200 / not-ready=503)。 */
export function readinessHttpStatus(result: ReadinessResult): number {
  return result.ready ? 200 : 503;
}
