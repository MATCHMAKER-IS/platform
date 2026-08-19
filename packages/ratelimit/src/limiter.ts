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
/**
 * キーの最大長。
 *
 * **Redis のキー長は理論上 512MB まで許されるが、実用上は短く保つ。**
 * 256 はメールアドレス(254)に接頭辞が付いても収まる長さ。
 */
const MAX_KEY_LENGTH = 256;

/**
 * **回数の上限**を見張る器を作る。
 *
 * ログインの試行・API の呼び出しなど、**短時間に繰り返されると困るもの**に使います。
 *
 * 【誰を数えるか】
 * **鍵の決め方が要です。** IP だけで数えると、**同じ会社の全員が 1 人分**になります
 * （社内からは同じ IP に見えるため）。**利用者 ID と組み合わせて**ください。
 *
 * 【保存先】
 * `store` を差し替えられます。**メモリ実装は 1 プロセス内でしか効きません**
 * ——2 台構成なら**上限が実質 2 倍**になります。台数を増やすなら Redis 実装へ。
 *
 * @param config `store`（保存先）・`limit`（何回まで）・`windowSeconds`（何秒間で）
 * @returns 上限を確かめる器（`consume` で 1 回消費します）
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  const { store, limit, windowSeconds } = config;
  return {
    async check(key) {
      // **キーの長さを切り詰める。** キーは外部入力から組み立てられることが多く
      // (`login:${email}` など)、任意長を通すと**毎回違う巨大な文字列を送るだけで
      // ストアにキーが溜まり続ける**——レート制限そのものが攻撃の的になる。
      //
      // 切り詰めても**別々の入力が同じキーになるだけ**で、制限は緩まない
      // (むしろ厳しくなる方向)。呼び出し側で長さを検証するのが本筋だが、
      // 忘れてもここで止まる(2026-08)。
      const safeKey = key.length > MAX_KEY_LENGTH ? key.slice(0, MAX_KEY_LENGTH) : key;
      const r = await tryCatch(() => store.increment(safeKey, windowSeconds));
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
