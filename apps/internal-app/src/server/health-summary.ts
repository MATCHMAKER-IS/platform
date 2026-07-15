/**
 * システムヘルス。主要データの件数と各種チェック結果をまとめ、全体の健全性を判定する。純粋な集計のみ。
 * @packageDocumentation
 */

/** 個別チェック。 */
export interface HealthCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

/** ヘルスレポート。 */
export interface HealthReport {
  healthy: boolean;
  checks: HealthCheck[];
  counts: Record<string, number>;
}

/** 件数とチェックからヘルスレポートを作る（1 つでも ok=false なら unhealthy）。 */
export function healthReport(counts: Record<string, number>, checks: HealthCheck[]): HealthReport {
  return { healthy: checks.every((c) => c.ok), checks, counts };
}
