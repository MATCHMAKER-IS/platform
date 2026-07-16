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

/**
 * 依存の健全性をまとめて確認する。
 *
 * **1 つが遅くても全体が止まらない**よう、並列に実行してタイムアウトを設ける。
 *
 * @param checks 確認する項目(名前 → 確認する関数)
 * @param options.timeoutMs 1 項目あたりのタイムアウト(既定 2000)
 * @param options.now 時刻の取得(テスト注入用)
 * @returns 各項目の結果。**タイムアウトも「異常」として扱う**(応答しないのは落ちているのと同じ)
 */
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
