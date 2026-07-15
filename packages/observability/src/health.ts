/**
 * ヘルスチェック(liveness / readiness)。依存(DB/キャッシュ/外部API)の可否を集約する。
 * @packageDocumentation
 */

/** 個別チェックの結果。 */
export interface CheckResult { name: string; status: "up" | "down"; durationMs: number; error?: string }
/** 全体の結果。 */
export interface HealthReport { status: "healthy" | "unhealthy"; checks: CheckResult[]; timestamp: number }

/** 1 つの依存チェック(true/void で up、throw で down)。 */
export type HealthCheck = () => Promise<void | boolean> | void | boolean;

/** チェック群を実行して集約する(タイムアウト付き)。 */
export async function runHealthChecks(checks: Record<string, HealthCheck>, options: { timeoutMs?: number; now?: () => number } = {}): Promise<HealthReport> {
  const timeoutMs = options.timeoutMs ?? 3000;
  const now = options.now ?? (() => Date.now());
  const results: CheckResult[] = await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      const start = now();
      try {
        const withTimeout = Promise.race([
          Promise.resolve(check()),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
        ]);
        const r = await withTimeout;
        if (r === false) return { name, status: "down" as const, durationMs: now() - start, error: "check returned false" };
        return { name, status: "up" as const, durationMs: now() - start };
      } catch (e) {
        return { name, status: "down" as const, durationMs: now() - start, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  const status = results.every((r) => r.status === "up") ? "healthy" : "unhealthy";
  return { status, checks: results, timestamp: now() };
}
