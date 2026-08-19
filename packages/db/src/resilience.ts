/**
 * トランザクションの再試行とヘルスチェック。
 * @packageDocumentation
 */
// 生成物の型に縛られないよう、必要な形だけを要求する(client-types.ts 参照)
import type { RawCapableClient, TransactionClient, TransactionClientOf } from "./client-types";
import { tryCatch, type Result } from "@platform/core";
import { mapPrismaError, isRetryablePrismaError } from "./errors";
import { asTransactionAbort, type TransactionOptions } from "./transaction";

/** {@link transactionWithRetry} のオプション。 */
export interface RetryOptions extends TransactionOptions {
  /** 最大再試行回数(既定 3)。 */
  retries?: number;
  /** 再試行間隔(ミリ秒、既定 50、試行ごとに倍化)。 */
  baseDelayMs?: number;
}

/**
 * デッドロック/シリアライズ失敗(P2034 等)を自動再試行するトランザクション。
 * 一時的な書き込み競合に強くなる。回復不能な失敗は {@link mapPrismaError} で返す。
 *
 * @example
 * ```ts
 * const res = await transactionWithRetry(db, async (tx) => {
 *   const acc = await tx.account.update({ where: { id }, data: { balance: { decrement: 100 } } });
 *   return acc;
 * });
 * ```
 *
 * @param db Prisma クライアント
 * @param fn トランザクション内の処理
 * @param options.retries **リトライ回数**(最初の 1 回は含まない)。`baseDelayMs` は待ち時間の基準
 * @returns 処理の結果(**デッドロックは再試行で回復する**ことが多い)
 */
export async function transactionWithRetry<TClient extends RawCapableClient, T>(
  db: TClient,
  fn: (tx: TransactionClientOf<TClient>) => Promise<T>,
  options: RetryOptions = {},
): Promise<Result<T>> {
  const { retries = 3, baseDelayMs = 50, isolationLevel, timeoutMs, maxWaitMs } = options;
  const txOptions = { isolationLevel: isolationLevel as unknown, timeout: timeoutMs, maxWait: maxWaitMs };
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    // 実体は同じオブジェクト。型だけをクライアント側のものに合わせる
    const run = fn as unknown as (tx: TransactionClient) => Promise<T>;
    const res = await tryCatch(() => db.$transaction(run, txOptions as never));
    if (res.ok) return res;
    lastError = res.error.cause ?? res.error;
    // 明示的中止(abortTransaction)は再試行せず、その AppError をそのまま返す
    const aborted = asTransactionAbort(lastError);
    if (aborted) return { ok: false, error: aborted };
    if (!isRetryablePrismaError(lastError) || attempt === retries) break;
    await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
  }
  return { ok: false, error: mapPrismaError(lastError) };
}

/**
 * データベース接続の疎通確認(SELECT 1)。ヘルスチェックエンドポイント向き。
 * @returns 疎通 OK なら `ok(true)`、失敗は `DATABASE` の `err`
 * @param db Prisma クライアント
 */
export async function checkDatabase(db: RawCapableClient): Promise<Result<true>> {
  const res = await tryCatch(() => db.$queryRaw`SELECT 1`);
  return res.ok ? { ok: true, value: true } : { ok: false, error: mapPrismaError(res.error.cause ?? res.error) };
}
