/**
 * Redis ベースの冪等性ストア(本番実装)。複数インスタンス間で二重実行を防ぐ。
 * reserve は SET NX(アトミック予約)、complete/get は JSON の読み書き。
 * @packageDocumentation
 */
import type { IdempotencyRecord } from "./idempotency.js";

/** ioredis 互換の最小インターフェース。 */
export interface RedisIdempotencyClient {
  /** SET key json PX ttl NX 相当。予約成功なら "OK"、既存なら null。 */
  set(key: string, value: string, mode: "PX", ttlMs: number, cond: "NX"): Promise<string | null>;
  /** 上書き保存(complete 用)。 */
  setValue(key: string, value: string, ttlMs: number): Promise<void>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<void>;
}

/** 非同期の冪等性ストア(Redis 版)。 */
export interface AsyncIdempotencyStore {
  reserve(key: string, record: IdempotencyRecord): Promise<IdempotencyRecord | null>;
  complete(key: string, record: IdempotencyRecord): Promise<void>;
  get(key: string): Promise<IdempotencyRecord | null>;
  delete(key: string): Promise<void>;
}

/**
 * Redis 冪等性ストアを作る。
 * @param client ioredis 互換クライアント(またはフェイク)
 * @param ttlMs レコードの保持期間(既定 24 時間)
 * @param keyPrefix キー接頭辞(既定 "idem:")
 */
export function createRedisIdempotencyStore(client: RedisIdempotencyClient, ttlMs = 24 * 60 * 60 * 1000, keyPrefix = "idem:"): AsyncIdempotencyStore {
  const k = (key: string) => `${keyPrefix}${key}`;
  return {
    async reserve(key, record) {
      const res = await client.set(k(key), JSON.stringify(record), "PX", ttlMs, "NX");
      if (res === "OK") return null; // 予約成功(初回)
      const existing = await client.get(k(key)); // 既存レコードを返す(=予約失敗)
      return existing ? (JSON.parse(existing) as IdempotencyRecord) : null;
    },
    async complete(key, record) {
      await client.setValue(k(key), JSON.stringify(record), ttlMs);
    },
    async get(key) {
      const v = await client.get(k(key));
      return v ? (JSON.parse(v) as IdempotencyRecord) : null;
    },
    async delete(key) {
      await client.del(k(key));
    },
  };
}
