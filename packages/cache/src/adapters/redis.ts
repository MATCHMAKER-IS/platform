/**
 * Redis Adapter。複数インスタンス・本番向け。ioredis をここだけで import する。
 * @packageDocumentation
 */
import Redis from "ioredis";
import type { CacheAdapter } from "../index.js";

/** Redis 接続設定。 */
export interface RedisCacheConfig {
  /** 接続 URL(例: "redis://localhost:6379")。 */
  url: string;
  /** キーの接頭辞(名前空間)。 */
  keyPrefix?: string;
}

/** ioredis 互換の最小インターフェース(テスト差し替え用)。 */
export interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: (string | number)[]): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/**
 * Redis キャッシュ Adapter を作る。
 * @param configOrClient 接続設定、または ioredis 互換クライアント(テスト用)
 * @returns {@link CacheAdapter} 実装
 */
export function createRedisCache(configOrClient: RedisCacheConfig | RedisCacheClient): CacheAdapter {
  const client: RedisCacheClient =
    "url" in configOrClient
      ? (new Redis(configOrClient.url, { keyPrefix: configOrClient.keyPrefix }) as unknown as RedisCacheClient)
      : configOrClient;
  return {
    async get(key) {
      return client.get(key);
    },
    async set(key, value, ttlSeconds) {
      if (ttlSeconds) await client.set(key, value, "EX", ttlSeconds);
      else await client.set(key, value);
    },
    async delete(key) {
      await client.del(key);
    },
  };
}
