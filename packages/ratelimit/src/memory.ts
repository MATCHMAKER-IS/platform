/**
 * メモリストア(単一インスタンス・開発向け)。
 * @packageDocumentation
 */
import type { RateLimitStore } from "./types.js";

/**
 * メモリのレート制限ストアを作る。
 * @returns {@link RateLimitStore} 実装
 */
export function createMemoryStore(): RateLimitStore {
  const counters = new Map<string, { count: number; expiresAt: number }>();
  return {
    async increment(key: string, windowSeconds: number) {
      const now = Date.now();
      const entry = counters.get(key);
      if (!entry || entry.expiresAt < now) {
        counters.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
        return 1;
      }
      entry.count += 1;
      return entry.count;
    },
  };
}
