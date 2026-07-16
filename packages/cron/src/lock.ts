/**
 * 分散ロック。複数インスタンスでの定期ジョブ重複実行を防ぐ。
 * 実体は Redis 等(SET NX PX 相当)。ここでは抽象とメモリ実装を提供する。
 * @packageDocumentation
 */

/** ロックストア。 */
export interface LockStore {
  /** key を ttlMs だけ確保。取得できたら true(既に保持されていれば false)。 */
  acquire(key: string, ttlMs: number): Promise<boolean> | boolean;
  /** ロックを解放。 */
  release(key: string): Promise<void> | void;
}

/**
 * メモリ実装(単一プロセス・TTL 付き)。分散では Redis 実装に差し替える。
 *
 *
 * @param options.now 時刻の取得(テスト注入用)
 * @returns ロックストア(**単一プロセス内のみ**。テスト用)
 */
export function createMemoryLockStore(now: () => number = () => Date.now()): LockStore {
  const held = new Map<string, number>(); // key -> expiresAt
  return {
    acquire(key, ttlMs) {
      const t = now();
      const exp = held.get(key);
      if (exp !== undefined && exp > t) return false; // 有効なロックあり
      held.set(key, t + ttlMs);
      return true;
    },
    release(key) { held.delete(key); },
  };
}
