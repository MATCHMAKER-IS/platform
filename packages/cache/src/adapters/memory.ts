/**
 * メモリ Adapter(TTL 付き)。単一インスタンス・開発向け。
 * @packageDocumentation
 */
import type { CacheAdapter } from "../index.js";

/**
 * メモリキャッシュ Adapter を作る。
 * @returns {@link CacheAdapter} 実装
 */
export function createMemoryCache(): CacheAdapter {
  const store = new Map<string, { value: string; expiresAt?: number }>();
  return {
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      store.set(key, {
        value,
        expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
      });
    },
    async delete(key) {
      store.delete(key);
    },
  };
}
