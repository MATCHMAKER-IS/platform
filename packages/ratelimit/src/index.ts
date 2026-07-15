/**
 * `@platform/ratelimit` — レート制限。ログイン試行・API 濫用の抑止に使う。
 * ストアは差し替え可能(メモリ / Redis)。
 * @packageDocumentation
 */
export { createRateLimiter, type RateLimiter, type RateLimiterConfig } from "./limiter.js";
export { createMemoryStore } from "./memory.js";
export { createRedisStore } from "./redis.js";
export type { RateLimitStore, RateLimitResult } from "./types.js";
