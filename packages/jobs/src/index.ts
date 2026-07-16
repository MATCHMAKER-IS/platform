/**
 * `@platform/jobs` — 非同期ジョブ(キュー)の共通部品。
 *
 * 重い処理・遅延処理・定期処理をリクエストから切り離して実行する。
 * 内部実装は BullMQ(Redis バックエンド)。アプリはキューへの投入と
 * ワーカーの登録だけを行い、接続や再試行の詳細は基盤が持つ。
 *
 * @packageDocumentation
 */

import { Queue, Worker, type JobsOptions, type Processor } from "bullmq";
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** BullMQ Queue の最小インターフェース(テスト差し替え用)。 */
export interface QueueLike {
  add(name: string, data: object, options?: JobsOptions): Promise<unknown>;
  close(): Promise<void>;
}

/** Redis 接続設定。 */
export interface JobsConnection {
  /** 例: "redis://localhost:6379" */
  url: string;
}

/**
 * Redis URL から接続情報(host/port/password)を作る。
 *
 * @param url Redis の URL
 */
export function connectionFromUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    ...(u.password ? { password: u.password } : {}),
  };
}

/** 型付きキュー。 */
export interface TypedQueue<T> {
  /** ジョブを投入する。 */
  add(name: string, data: T, options?: JobsOptions): Promise<Result<void>>;
  /** キューを閉じる。 */
  close(): Promise<void>;
}

/**
 * 型付きキューを作る(ジョブ投入側)。
 *
 * @typeParam T ジョブデータの型
 * @param queueName キュー名
 * @param connection Redis 接続
 * @returns {@link TypedQueue}
 *
 * @example
 * ```ts
 * const emails = createQueue<{ to: string }>("emails", { url: env.REDIS_URL });
 * await emails.add("welcome", { to: "a@example.co.jp" });
 * ```
 */
export function createQueue<T>(
  queueName: string,
  connection: JobsConnection,
  queueFactory?: (name: string, opts: unknown) => QueueLike,
): TypedQueue<T> {
  const opts = {
    connection: connectionFromUrl(connection.url),
    // 既定の再試行方針(指数バックオフ 3 回)。アプリ側で上書き可。
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
  };
  const queue: QueueLike = queueFactory ? queueFactory(queueName, opts) : (new Queue(queueName, opts as never) as unknown as QueueLike);
  return {
    async add(name, data, options) {
      const res = await tryCatch(() => queue.add(name, data as object, options));
      return res.ok
        ? { ok: true, value: undefined }
        : {
            ok: false,
            error: new AppError(ErrorCode.EXTERNAL, "ジョブの投入に失敗しました", {
              cause: res.error.cause ?? res.error,
            }),
          };
    },
    close: () => queue.close(),
  };
}

/**
 * ワーカーを作る(ジョブ処理側)。ハンドラ内の例外は BullMQ が再試行する。
 *
 * @typeParam T ジョブデータの型
 * @param queueName キュー名(投入側と一致させる)
 * @param handler   1 ジョブを処理する関数
 * @param connection Redis 接続
 * @returns BullMQ の {@link Worker}(`worker.close()` で停止)
 *
 * @example
 * ```ts
 * const worker = createWorker<{ to: string }>("emails", async (job) => {
 *   await mailer.sendMail({ to: job.data.to, subject: "ようこそ", text: "..." });
 * }, { url: env.REDIS_URL });
 * ```
 */
export function createWorker<T>(
  queueName: string,
  handler: (job: { data: T; name: string }) => Promise<void>,
  connection: JobsConnection,
): Worker {
  const processor: Processor = async (job) => {
    await handler({ data: job.data as T, name: job.name });
  };
  return new Worker(queueName, processor, { connection: connectionFromUrl(connection.url) });
}

export { createMemoryQueue, type MemoryQueue, type MemoryQueueOptions, type FailedJob } from "./memory";
export { defineJob, type JobDefinition } from "./define";
