/**
 * `Result` 型 — 例外を投げずに成功/失敗を戻り値で表現する規約。
 *
 * 外部連携など「失敗が想定内」の処理では例外ではなくこの型を返すことで、
 * 呼び出し側に握りつぶしのないハンドリングを促す。
 *
 * @packageDocumentation
 */

import { AppError } from "./error";

/** 成功を表す。 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** 失敗を表す。エラーは必ず {@link AppError} に正規化される。 */
export interface Err {
  readonly ok: false;
  readonly error: AppError;
}

/**
 * 処理結果。成功なら `value`、失敗なら `error` を持つ。
 *
 * @typeParam T 成功時の値の型
 */
export type Result<T> = Ok<T> | Err;

/**
 * 成功の {@link Result} を作る。
 *
 * @param value 成功時の値
 * @returns `ok: true` と `value` を持つ成功結果
 *
 * @example
 * ```ts
 * const r = ok(42);
 * if (r.ok) console.log(r.value); // 42
 * ```
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * 失敗の {@link Result} を作る。
 *
 * @param error {@link AppError}(または AppError に正規化可能な値)
 * @returns `ok: false` と `error` を持つ失敗結果
 */
export function err(error: AppError): Err {
  return { ok: false, error };
}

/**
 * 例外を投げうる非同期処理を {@link Result} でラップする。
 * `throw` を境界の外に漏らさないための共通ヘルパー。
 *
 * @param fn 実行する非同期処理
 * @returns 成功なら `ok`、例外は {@link AppError} に正規化した `err`
 *
 * @example
 * ```ts
 * const res = await tryCatch(() => fetchUser(id));
 * if (!res.ok) log.error(res.error);
 * else use(res.value);
 * ```
 */
export async function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(AppError.from(e));
  }
}
