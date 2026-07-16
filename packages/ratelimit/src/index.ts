/**
 * `@platform/ratelimit` — レート制限。ログイン試行・API 濫用の抑止に使う。
 * ストアは差し替え可能(メモリ / Redis)。
 * @packageDocumentation
 */
export { createRateLimiter, type RateLimiter, type RateLimiterConfig } from "./limiter";
export { createMemoryStore } from "./memory";
export { createRedisStore } from "./redis";
export type { RateLimitStore, RateLimitResult } from "./types";
