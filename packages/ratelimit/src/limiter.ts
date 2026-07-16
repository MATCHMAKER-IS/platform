/**
 * 固定ウィンドウ方式のレート制限。ログイン試行や API 濫用の抑止に使う。
 * @packageDocumentation
 */
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";
import type { RateLimitStore, RateLimitResult } from "./types";

/** {@link createRateLimiter} の設定。 */
export interface RateLimiterConfig {
  store: RateLimitStore;
  /** ウィンドウあたりの上限回数。 */
  limit: number;
  /** ウィンドウ長(秒)。 */
  windowSeconds: number;
}

/** レートリミッタ。 */
export interface RateLimiter {
  /**
   * キー(IP・ユーザーID・"login:email" など)の 1 回分を消費し、許可可否を返す。
   * @param key 制限単位のキー
   * @returns 判定結果の `ok`、ストア障害時は `EXTERNAL` の `err`
   */
  check(key: string): Promise<Result<RateLimitResult>>;
}

/**
 * レートリミッタを作る。
 * @param config ストア・上限・ウィンドウ
 * @returns {@link RateLimiter}
 *
 * @example
 * ```ts
 * const limiter = createRateLimiter({ store, limit: 5, windowSeconds: 60 });
 * const res = await limiter.check(`login:${email}`);
 * if (res.ok && !res.value.allowed) throw new AppError("UNAUTHORIZED", "試行回数が上限を超えました");
 * ```
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const { store, limit, windowSeconds } = config;
  return {
    async check(key) {
      const r = await tryCatch(() => store.increment(key, windowSeconds));
      if (!r.ok) {
        return {
          ok: false,
          error: new AppError(ErrorCode.EXTERNAL, "レート制限ストアの操作に失敗しました", {
            cause: r.error.cause ?? r.error,
          }),
        };
      }
      const current = r.value;
      return {
        ok: true,
        value: { allowed: current <= limit, remaining: Math.max(0, limit - current), current, limit },
      };
    },
  };
}
