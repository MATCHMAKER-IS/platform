/**
 * インメモリのジョブキュー(Redis 不要)。開発・テスト・小規模用途向け。
 * BullMQ の {@link TypedQueue} と同じ add API を持ち、登録した worker で逐次処理する。
 * 失敗時は attempts 回まで再試行し、超過分は failed(デッドレター)に退避する
 * (BullMQ の attempts 挙動を模した faithful なテストダブル)。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import type { TypedQueue } from "./index.js";

/** 失敗ジョブ(デッドレター)の記録。 */
export interface FailedJob<T> { name: string; data: T; attempts: number; error: string }

/** インメモリキュー(worker 登録つき)。 */
export interface MemoryQueue<T> extends TypedQueue<T> {
  /** 処理関数を登録する(以後 add された順に実行)。 */
  process(handler: (data: T, name: string) => Promise<void>): void;
  /** すべてのジョブが処理し終わるまで待つ(テスト用)。 */
  drain(): Promise<void>;
  /** attempts を超えて失敗したジョブ(デッドレター)。 */
  failed(): FailedJob<T>[];
}

/** {@link createMemoryQueue} のオプション。 */
export interface MemoryQueueOptions {
  /** 失敗時の最大試行回数(既定 3。BullMQ の defaultJobOptions.attempts に対応)。 */
  attempts?: number;
}

/**
 * インメモリキューを作る。
 * @example
 * ```ts
 * const q = createMemoryQueue<{ to: string }>();
 * q.process(async (data) => sendMail(data.to));
 * await q.add("welcome", { to: "a@example.co.jp" });
 * await q.drain();
 * ```
 */
export function createMemoryQueue<T>(options: MemoryQueueOptions = {}): MemoryQueue<T> {
  const attempts = options.attempts ?? 3;
  const queue: { name: string; data: T }[] = [];
  const deadLetter: FailedJob<T>[] = [];
  let handler: ((data: T, name: string) => Promise<void>) | null = null;
  let running: Promise<void> = Promise.resolve();

  const pump = () => {
    running = running.then(async () => {
      while (handler && queue.length > 0) {
        const job = queue.shift()!;
        let lastError = "";
        let ok = false;
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try { await handler(job.data, job.name); ok = true; break; }
          catch (e) { lastError = e instanceof Error ? e.message : String(e); }
        }
        if (!ok) deadLetter.push({ name: job.name, data: job.data, attempts, error: lastError });
      }
    });
    return running;
  };

  return {
    async add(name: string, data: T): Promise<Result<void>> {
      queue.push({ name, data });
      if (handler) void pump();
      return { ok: true, value: undefined };
    },
    process(h) {
      handler = h;
      void pump();
    },
    async drain() {
      await pump();
    },
    failed() {
      return [...deadLetter];
    },
    async close() {
      queue.length = 0;
      handler = null;
    },
  };
}
