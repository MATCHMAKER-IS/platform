/**
 * Redis ストア(複数インスタンス・本番向け)。
 * INCR と EXPIRE を Lua で1回のラウンドトリップかつアトミックに実行する。
 * (INCR 後に EXPIRE が失敗すると TTL が付かず永久ブロックになる問題を防ぐ。)
 * @packageDocumentation
 */
import Redis from "ioredis";
import type { RateLimitStore } from "./types.js";

/** INCR + 初回のみ EXPIRE をアトミックに行う Lua。戻り値は現在カウント。 */
const INCR_EXPIRE_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
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
  const client: RedisLike = typeof urlOrClient === "string" ? (new Redis(urlOrClient) as unknown as RedisLike) : urlOrClient;
  return {
    async increment(key: string, windowSeconds: number) {
      const result = await client.eval(INCR_EXPIRE_LUA, 1, key, windowSeconds);
      return Number(result);
    },
  };
}
