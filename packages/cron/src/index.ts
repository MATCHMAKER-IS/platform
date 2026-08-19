/**
 * `@platform/cron` — 定期実行(スケジューラ)の共通部品。
 *
 * 「毎日9時に集計」「1時間ごとに同期」などの定期ジョブを登録・管理する。
 * 内部実装は croner。各ジョブの例外は捕捉してハンドラに渡し、1 つの失敗が
 * スケジューラ全体を止めないようにする。
 *
 * 注意: 複数インスタンスで動かすと同じ時刻に重複実行される。冗長構成では
 * `@platform/jobs`(BullMQ)の repeatable job を使うか、リーダー選出で 1 台に
 * 限定すること。
 *
 * @packageDocumentation
 */

import { Cron } from "croner";
import { AppError, ErrorCode } from "@platform/core";
import { createGuardedJob, type JobStats, type JobResult } from "./runner";
import type { LockStore } from "./lock";

/** 登録する定期ジョブ。 */
export interface CronJob {
  /** ジョブ名(ログ・管理用)。 */
  name: string;
  /**
   * cron 式(例 `"0 9 * * *"` = 毎日 9 時)。croner の拡張構文も可。
   *
   * **月末処理に `31` を使わない。** `"0 0 31 * *"` は
   * **2 / 4 / 6 / 9 / 11 月に実行されない**(31 日が無いため)——
   * 年 5 回、月次の締めや請求が飛ぶ。**`"0 0 L * *"`(L = 月末)**を使うこと。
   *
   * **営業日は cron 式では書けない。** 祝日を扱えないので、
   * 「営業日の朝 9 時」は**毎日動かして handler の中で判定する**
   * (`@platform/datetime` の `isBusinessDay`)。
   * 祝日に動いて何もせず終わるのは正常な動作(2026-08 に明記)。
   */
  schedule: string;
  /** 実行内容。 */
  handler: () => Promise<void>;
  /** タイムゾーン(既定: "Asia/Tokyo")。 */
  timezone?: string;
  /** 前回実行が継続中なら今回をスキップ(単一インスタンスの多重防止)。 */
  preventOverlap?: boolean;
  /** 実行前に 0..jitterMs のランダム遅延(同時発火の平準化)。 */
  jitterMs?: number;
  /**
   * 分散ロック(複数インスタンスでの重複実行防止)。
   *
   * **`ttlMs` は処理時間より十分長くすること。** 短いと処理の途中で
   * ロックが期限切れになり、**別インスタンスが動き出して二重実行になる**
   * ——これはこの仕組みが防ぐはずのもの。誤解放はトークン照合で防げるが、
   * 二重実行そのものは防げない。
   *
   * 目安は「最も遅かったときの実行時間 × 3」。短すぎるより長すぎる方が安全
   * (長すぎても、正常終了時は `finally` で必ず解放される)。
   */
  lock?: { store: LockStore; ttlMs: number; key?: string };
}

/** ジョブ失敗時に呼ばれるハンドラ。 */
export type CronErrorHandler = (jobName: string, error: AppError) => void;

/** ジョブ結果コールバック(メトリクス連携用)。 */
export type CronResultHandler = (result: JobResult) => void;

/** スケジューラ。 */
export interface Scheduler {
  /** 登録した全ジョブを開始する。 */
  start(): void;
  /** 全ジョブを停止する。 */
  stop(): void;
  /** 登録済みジョブ名の一覧。 */
  jobNames(): string[];
  /** ジョブ別の実行統計(runs/successes/failures/skipped 等)。 */
  stats(): Record<string, JobStats>;
}

/**
 * スケジューラを作る。ジョブの例外は `onError` に渡され、握りつぶさない。
 *
 * @param jobs    登録する定期ジョブ
 * @param onError ジョブ失敗時のハンドラ(ログ出力等。既定は何もしない)
 * @param onResult 成功も含めた結果のハンドラ（**所要時間の記録**などに使う）
 * @returns {@link Scheduler}
 *
 * @example
 * ```ts
 * const scheduler = createScheduler(
 *   [{ name: "daily-report", schedule: "0 9 * * *", handler: async () => { await buildReport(); } }],
 *   (name, err) => log.error({ name, err }, "cron失敗"),
 * );
 * scheduler.start();
 * ```
 */
export function createScheduler(jobs: CronJob[], onError: CronErrorHandler = () => {}, onResult: CronResultHandler = () => {}): Scheduler {
  const crons: Cron[] = [];
  const names = jobs.map((j) => j.name);
  // ジョブ名 → ガード付きランナー(統計を保持)
  const guarded = new Map(jobs.map((job) => [job.name, createGuardedJob({
    name: job.name,
    handler: job.handler,
    preventOverlap: job.preventOverlap,
    jitterMs: job.jitterMs,
    lock: job.lock,
    onResult,
    onError: (name, err) => onError(name, AppError.from(err, ErrorCode.INTERNAL)),
  })]));

  return {
    start() {
      for (const job of jobs) {
        const runner = guarded.get(job.name)!;
        const cron = new Cron(
          job.schedule,
          { name: job.name, timezone: job.timezone ?? "Asia/Tokyo", paused: false },
          async () => { await runner.run(); },
        );
        crons.push(cron);
      }
    },
    stop() {
      for (const c of crons) c.stop();
      crons.length = 0;
    },
    jobNames() {
      return [...names];
    },
    stats() {
      const out: Record<string, JobStats> = {};
      for (const [name, runner] of guarded) out[name] = runner.stats();
      return out;
    },
  };
}

export { createMemoryLockStore, type LockStore } from "./lock";
export { createRedisLockStore, type RedisLockClient } from "./lock-redis";
export { tryAcquireFileLock, releaseFileLock, acquireFileLock, createFileLockStore, type FileLockOptions, type AcquireFileLockOptions } from "./lock-file";
export { createGuardedJob, type JobStats, type JobResult, type GuardOptions } from "./runner";
