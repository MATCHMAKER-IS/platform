/**
 * Redis ベースの分散ロック(本番実装)。複数インスタンスでの重複実行を確実に防ぐ。
 * 取得は SET NX PX(アトミック)、解放は所有者トークン照合(Lua)で「自分のロックだけ」を消す。
 * @packageDocumentation
 */
import type { LockStore } from "./lock.js";

/** ioredis 互換の最小インターフェース(テスト差し替え用)。 */
export interface RedisLockClient {
  /** SET key value PX ttl NX 相当。取得できたら "OK"、既存なら null。 */
  set(key: string, value: string, mode: "PX", ttlMs: number, cond: "NX"): Promise<string | null>;
  /** Lua スクリプト実行(所有者照合つき解放)。 */
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
}

/** 所有者トークンが一致する時だけ削除する(他インスタンスのロックを誤解放しない)。 */
const RELEASE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

/** ランダムな所有者トークン(取得ごとに一意)。 */
function newToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Redis 分散ロックを作る。
 * @param client ioredis 互換クライアント(またはテスト用フェイク)
 * @param keyPrefix キー接頭辞(既定 "lock:")
 */
export function createRedisLockStore(client: RedisLockClient, keyPrefix = "lock:"): LockStore {
  // key -> 所有トークン(このプロセスが保持中のもの)
  const tokens = new Map<string, string>();
  return {
    async acquire(key, ttlMs) {
      const token = newToken();
      const res = await client.set(`${keyPrefix}${key}`, token, "PX", ttlMs, "NX");
      if (res === "OK") { tokens.set(key, token); return true; }
      return false;
    },
    async release(key) {
      const token = tokens.get(key);
      if (!token) return; // 保持していない
      await client.eval(RELEASE_LUA, 1, `${keyPrefix}${key}`, token);
      tokens.delete(key);
    },
  };
}
