/**
 * Redis ストア(複数インスタンス・本番向け)。
 * INCR と EXPIRE を Lua で1回のラウンドトリップかつアトミックに実行する。
 * (INCR 後に EXPIRE が失敗すると TTL が付かず永久ブロックになる問題を防ぐ。)
 * @packageDocumentation
 */
import Redis from "ioredis";
import type { RateLimitStore } from "./types";

/**
 * カウントを 1 増やし、窓の期限を保つ。
 *
 * **`current == 1` だけを見ない。** それだと「キーはあるが TTL が無い」状態から
 * 抜け出せず、**その利用者が永久に制限され続ける**。
 * TTL 無しのキーは、別の経路で同名キーが `SET` された場合や、
 * 過去の不具合で残った場合に生まれる。カウントは増え続け、
 * `current == 1` は二度と真にならないので EXPIRE も設定されない。
 *
 * `TTL` が `-1`(期限なし)なら設定し直す。**Lua は原子的**なので、
 * INCR と EXPIRE の間に他の処理は割り込まない。
 */
const INCR_EXPIRE_LUA = `
local current = redis.call('INCR', KEYS[1])
-- TTL: -2=キー無し(INCR 直後なので起きない) / -1=期限なし / 正=残り秒数
if current == 1 or redis.call('TTL', KEYS[1]) == -1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

/** ioredis 互換の最小インターフェース(テスト差し替え用)。 */
export interface RedisLike {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

/**
 * Redis のレート制限ストアを作る。
 * @param urlOrClient Redis 接続 URL、または ioredis 互換クライアント(テスト用)
 * @returns {@link RateLimitStore} 実装
 */
export function createRedisStore(urlOrClient: string | RedisLike): RateLimitStore {
  const client: RedisLike = typeof urlOrClient === "string" ? (new Redis(urlOrClient, {
        // **待たせない。** ここは fail open(ストア障害時は通す)する前提なので、
        // 既定(`maxRetriesPerRequest: 20`)のままだと**1 リクエストが数十秒待たされる**
        // ——「落ちていても本流を止めない」という設計が成立しない。
        // `enableOfflineQueue: false` は、接続前のコマンドをキューに溜めない
        // (溜めると Redis が落ちている間メモリに積み上がる)。2026-08。
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      }) as unknown as RedisLike) : urlOrClient;
  return {
    async increment(key: string, windowSeconds: number) {
      const result = await client.eval(INCR_EXPIRE_LUA, 1, key, windowSeconds);
      return Number(result);
    },
  };
}
