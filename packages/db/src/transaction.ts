/**
 * トランザクション制御。
 * Prisma のインタラクティブトランザクションでは「正常 return = コミット」
 * 「throw = ロールバック」。本モジュールはそれを Result で扱いやすくし、分離レベル指定と
 * 明示的な中止(ロールバック)手段を提供する。
 * @packageDocumentation
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";
import { mapPrismaError } from "./errors.js";

/** トランザクション分離レベル。 */
export type IsolationLevel = "ReadUncommitted" | "ReadCommitted" | "RepeatableRead" | "Serializable";

/** {@link withTransaction} のオプション。 */
export interface TransactionOptions {
  /** 分離レベル(既定は DB 既定 = ReadCommitted)。 */
  isolationLevel?: IsolationLevel;
  /** トランザクション全体のタイムアウト(ミリ秒)。 */
  timeoutMs?: number;
  /** ロック待ちの最大時間(ミリ秒)。 */
  maxWaitMs?: number;
}

/** 明示的ロールバック用のセンチネル。 */
class TransactionAbort extends Error {
  readonly appError: AppError;
  constructor(appError: AppError) { super(appError.message); this.appError = appError; }
}

/**
 * エラーが {@link abortTransaction} による明示的中止なら、その AppError を返す(そうでなければ null)。
 * リトライ系トランザクションが「中止=非再試行」を正しく扱うために使う。
 *
 * @param error エラー
 * @returns 中断の理由。**中断でなければ null**
 */
export function asTransactionAbort(error: unknown): AppError | null {
  return error instanceof TransactionAbort ? error.appError : null;
}

/**
 * トランザクションを明示的に中止(ロールバック)する。以降の処理は実行されず、
 * それまでの変更は取り消される。{@link withTransaction} 内で使う。
 * @param reason 中止理由(文字列なら CONFLICT、AppError ならそのコードで返る)
 * @returns 返らない(必ず例外を投げる)
 * @throws トランザクションを中断する特別な例外(**ロールバックされる**)
 */
export function abortTransaction(reason: string | AppError): never {
  throw new TransactionAbort(typeof reason === "string" ? new AppError(ErrorCode.CONFLICT, reason) : reason);
}

/**
 * トランザクションを実行する。正常終了でコミット、例外でロールバック。
 * `abortTransaction()` で任意の地点から明示的にロールバックできる。
 *
 * @example
 * ```ts
 * const res = await withTransaction(db, async (tx) => {
 *   const from = await tx.account.update({ where: { id: a }, data: { balance: { decrement: 100 } } });
 *   if (from.balance < 0) abortTransaction("残高不足");          // ここでロールバック
 *   await tx.account.update({ where: { id: b }, data: { balance: { increment: 100 } } });
 *   return from;                                                  // ここでコミット
 * }, { isolationLevel: "Serializable" });
 * ```
 *
 * @param db Prisma クライアント
 * @param fn トランザクション内の処理
 * @returns 処理の結果(**例外が出たらロールバック**。{@link abortTransaction} で明示的に中断できる)
 */
export async function withTransaction<T>(
  db: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<Result<T>> {
  const txOptions = {
    isolationLevel: options.isolationLevel as unknown,
    timeout: options.timeoutMs,
    maxWait: options.maxWaitMs,
  };
  const res = await tryCatch(() => db.$transaction(fn, txOptions as never));
  if (res.ok) return res;
  const cause = res.error.cause ?? res.error;
  const aborted = asTransactionAbort(cause);
  if (aborted) return { ok: false, error: aborted };
  return { ok: false, error: mapPrismaError(cause) };
}
