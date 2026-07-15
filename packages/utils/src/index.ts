/**
 * `@platform/utils` — 汎用ヘルパー。
 *
 * ⚠️ 運用ルール(これを守らないと"何でも入る引き出し"になり属人化が再発する):
 *  - **純粋・汎用・十分にテスト済み**の関数のみ置く。業務ロジックは置かない。
 *  - 1 箇所でしか使わないものは置かない(その場に書く)。
 *  - 既存の有名ライブラリで足りるものは、それをラップして使う。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

/** 指定ミリ秒だけ待つ。 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 配列を size ごとのチャンクに分割する。 */
export function chunk<T>(array: readonly T[], size: number): T[][] {
  if (size <= 0) throw new AppError(ErrorCode.VALIDATION, "size は 1 以上である必要があります");
  const out: T[][] = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

/** keyFn の結果でグルーピングする。 */
export function groupBy<T, K extends string | number>(
  array: readonly T[],
  keyFn: (item: T) => K,
): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of array) {
    const k = keyFn(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

/** keyFn の結果で重複を除いた配列を返す(先勝ち)。 */
export function uniqueBy<T, K>(array: readonly T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of array) {
    const k = keyFn(item);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

/**
 * 網羅性チェック。switch の default 等で「起きないはず」を型で保証する。
 * @param value never のはずの値
 * @throws {@link @platform/core#AppError} 到達したら実行時にも失敗させる
 */
export function assertNever(value: never): never {
  throw new AppError(ErrorCode.INTERNAL, `到達しないはずの値です: ${String(value)}`);
}

/**
 * JSON を安全にパースする(例外を投げず Result で返す)。
 * @param text JSON 文字列
 * @returns パース結果の `ok`、失敗なら `VALIDATION` の `err`
 */
export function safeJsonParse<T = unknown>(text: string): Result<T> {
  try {
    return ok(JSON.parse(text) as T);
  } catch (e) {
    return err(new AppError(ErrorCode.VALIDATION, "JSONの解析に失敗しました", { cause: e }));
  }
}

/** {@link retry} のオプション。 */
export interface RetryOptions {
  /** 試行回数(既定: 3)。 */
  attempts?: number;
  /** 初回待機ミリ秒(指数的に増加。既定: 200)。 */
  baseDelayMs?: number;
}

/**
 * 非同期処理を指数バックオフで再試行する。全試行が失敗したら最後の例外を投げる。
 * @typeParam T 戻り値
 * @param fn 実行する処理
 * @param options 試行回数・待機時間
 * @returns fn の成功値
 *
 * @example
 * ```ts
 * const data = await retry(() => fetchFlaky(), { attempts: 5 });
 * ```
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 200 } = options;
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i);
    }
  }
  throw AppError.from(lastError);
}

export * from "./strings.js";
export * from "./numbers.js";

export * from "./similarity.js";

export * from "./japanese-number.js";
export * from "./function.js";
export * from "./object.js";
export * from "./array.js";
export * from "./async.js";
