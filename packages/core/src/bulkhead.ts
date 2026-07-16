/**
 * バルクヘッド(並行制限)とセマフォ。1つの遅い依存が全体の資源を食い潰すのを防ぐ。
 * 依存ごとに並行実行の上限を設け、超過分はキュー待機 or 即時拒否(バックプレッシャ)する。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "./error";

/** {@link createBulkhead} のオプション。 */
export interface BulkheadOptions {
  /** 同時実行の上限。 */
  maxConcurrent: number;
  /** 待機キューの上限(超えたら拒否)。0=待たせず即拒否、既定 Infinity=無制限に待つ。 */
  maxQueue?: number;
  /** 待機のタイムアウト(ms)。超えたら拒否。既定なし。 */
  queueTimeoutMs?: number;
}

/** バルクヘッド。 */
export interface Bulkhead {
  /** 並行上限内で fn を実行する。上限超過時はキュー待機(または拒否)。 */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** 実行中の件数。 */
  active(): number;
  /** 待機中の件数。 */
  queued(): number;
}

interface Waiter {
  resolve: () => void;
  reject: (e: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * バルクヘッドを作る。
 * @example
 * ```ts
 * const zohoBulkhead = createBulkhead({ maxConcurrent: 10, maxQueue: 100, queueTimeoutMs: 5000 });
 * await zohoBulkhead.run(() => zohoFetch(url)); // 同時10件まで。超過は待機、5秒待てず/100件超は拒否。
 * ```
 *
 * @param options 同時実行数・待機列の上限・待機のタイムアウト
 * @returns {@link Bulkhead}(`run` で処理を通す)
 * @throws {@link AppError} コード `RATE_LIMITED` — 待機列が溢れた / 待機がタイムアウトした場合(run 実行時)
 */
export function createBulkhead(options: BulkheadOptions): Bulkhead {
  const maxConcurrent = Math.max(1, options.maxConcurrent);
  const maxQueue = options.maxQueue ?? Infinity;
  const queueTimeoutMs = options.queueTimeoutMs;

  let running = 0;
  const waiters: Waiter[] = [];

  function acquire(): Promise<void> {
    if (running < maxConcurrent) {
      running++;
      return Promise.resolve();
    }
    if (waiters.length >= maxQueue) {
      // バックプレッシャ: これ以上待たせない(負荷を上流へ返す)。
      return Promise.reject(new AppError(ErrorCode.RATE_LIMITED, "処理が混雑しています(バルクヘッド上限)", { details: { maxConcurrent, maxQueue } }));
    }
    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject };
      if (queueTimeoutMs !== undefined) {
        waiter.timer = setTimeout(() => {
          const i = waiters.indexOf(waiter);
          if (i >= 0) waiters.splice(i, 1);
          reject(new AppError(ErrorCode.RATE_LIMITED, "処理の待機がタイムアウトしました", { details: { queueTimeoutMs } }));
        }, queueTimeoutMs);
      }
      waiters.push(waiter);
    });
  }

  function release(): void {
    const next = waiters.shift();
    if (next) {
      if (next.timer) clearTimeout(next.timer);
      next.resolve(); // running は維持(この枠を次の待機者へ引き継ぐ)
    } else {
      running--;
    }
  }

  return {
    async run(fn) {
      await acquire();
      try {
        return await fn();
      } finally {
        release();
      }
    },
    active: () => running,
    queued: () => waiters.length,
  };
}
