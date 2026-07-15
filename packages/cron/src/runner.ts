/**
 * 定期ジョブの実行ラッパー。ジッタ・オーバーラップ防止・分散ロック・実行統計を付与する。
 * @packageDocumentation
 */
import type { LockStore } from "./lock.js";

/** ジョブ実行の統計。 */
export interface JobStats {
  runs: number;
  successes: number;
  failures: number;
  skipped: number;
  lastDurationMs?: number;
  lastRunAt?: number;
  lastError?: string;
}

/** ジョブ実行結果(メトリクス連携用)。 */
export interface JobResult {
  name: string;
  outcome: "success" | "failure" | "skipped";
  durationMs: number;
  reason?: "overlap" | "lock";
  error?: string;
}

/** ラッパーの依存。 */
export interface GuardOptions {
  name: string;
  handler: () => Promise<void>;
  /** 前回実行が継続中なら今回をスキップ(単一インスタンスの多重防止)。 */
  preventOverlap?: boolean;
  /** 分散ロック(複数インスタンスの重複防止)。 */
  lock?: { store: LockStore; ttlMs: number; key?: string };
  /** 実行前に 0..jitterMs のランダム遅延(同時発火の平準化)。 */
  jitterMs?: number;
  /** 結果コールバック(メトリクス送信等)。 */
  onResult?: (result: JobResult) => void;
  /** 失敗時コールバック。 */
  onError?: (name: string, error: Error) => void;
  now?: () => number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** 状態つきのジョブランナーを作る(統計を保持)。 */
export function createGuardedJob(options: GuardOptions): { run: () => Promise<void>; stats: () => JobStats } {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const lockKey = options.lock?.key ?? `cron:${options.name}`;
  let running = false;
  const stats: JobStats = { runs: 0, successes: 0, failures: 0, skipped: 0 };

  const emit = (result: JobResult) => options.onResult?.(result);

  async function run(): Promise<void> {
    // オーバーラップ防止(単一インスタンス)
    if (options.preventOverlap && running) {
      stats.skipped += 1;
      emit({ name: options.name, outcome: "skipped", durationMs: 0, reason: "overlap" });
      return;
    }
    // ジッタ
    if (options.jitterMs && options.jitterMs > 0) await sleep(Math.floor(random() * options.jitterMs));
    // 分散ロック
    if (options.lock) {
      const acquired = await options.lock.store.acquire(lockKey, options.lock.ttlMs);
      if (!acquired) {
        stats.skipped += 1;
        emit({ name: options.name, outcome: "skipped", durationMs: 0, reason: "lock" });
        return;
      }
    }
    running = true;
    const start = now();
    try {
      await options.handler();
      const durationMs = now() - start;
      stats.runs += 1; stats.successes += 1; stats.lastDurationMs = durationMs; stats.lastRunAt = start;
      emit({ name: options.name, outcome: "success", durationMs });
    } catch (e) {
      const durationMs = now() - start;
      const err = e instanceof Error ? e : new Error(String(e));
      stats.runs += 1; stats.failures += 1; stats.lastDurationMs = durationMs; stats.lastRunAt = start; stats.lastError = err.message;
      emit({ name: options.name, outcome: "failure", durationMs, error: err.message });
      options.onError?.(options.name, err);
    } finally {
      running = false;
      if (options.lock) await options.lock.store.release(lockKey);
    }
  }

  return { run, stats: () => ({ ...stats }) };
}
