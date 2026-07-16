/**
 * Redis ベースの重複抑制ストア(本番実装)。複数インスタンス間で dedup を共有する。
 * markSeen は SET NX PX(アトミック)で「初回だけ成功」を利用する。
 * @packageDocumentation
 */
import type { SeenStore } from "./dedup.js";

/** ioredis 互換の最小インターフェース(テスト差し替え用)。同期/非同期どちらも可。 */
export interface RedisSeenClient {
  /** SET key value PX ttl NX 相当。初回は "OK"、既存なら null。 */
  set(key: string, value: string, mode: "PX", ttlMs: number, cond: "NX"): Promise<string | null>;
  /** キー存在確認(1=あり)。 */
  exists(key: string): Promise<number>;
}

/**
 * 注意: SeenStore の markSeen/has は同期シグネチャだが、Redis は非同期。
 * そのため本実装は非同期版インターフェース {@link AsyncSeenStore} を返す。
 * 呼び出し側(relay 等)は await して使う。
 */
export interface AsyncSeenStore {
  markSeen(key: string, ttlMs: number): Promise<boolean>;
  has(key: string): Promise<boolean>;
}

/**
 * Redis 重複抑制ストアを作る。
 * @param client ioredis 互換クライアント(またはフェイク)
 * @param keyPrefix キー接頭辞(既定 "seen:")
 * @returns 重複抑制ストア(**複数プロセスでも効く**。メモリ実装と違い本番で使える)
 */
export function createRedisSeenStore(client: RedisSeenClient, keyPrefix = "seen:"): AsyncSeenStore {
  return {
    async markSeen(key, ttlMs) {
      const res = await client.set(`${keyPrefix}${key}`, "1", "PX", ttlMs, "NX");
      return res !== "OK"; // 既存(=重複)なら true
    },
    async has(key) {
      return (await client.exists(`${keyPrefix}${key}`)) === 1;
    },
  };
}

/** SeenStore(同期IF)としても使えるよう、型の互換確認用。実運用は AsyncSeenStore を await する。 */
export type { SeenStore };
