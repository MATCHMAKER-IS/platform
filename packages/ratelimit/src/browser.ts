/**
 * ブラウザ・クライアントコンポーネント、および **Redis を使わないサーバ処理**の入口。
 *
 * バレル(`@platform/ratelimit`)は **ioredis** を読み込む。ioredis は
 * `dns` / `net` / `tls` / `fs` を使うため、バンドル対象に入ると
 * **`next build` が落ちる**。
 *
 * 上限の判定そのものとメモリ実装は依存を持たないので、ここから提供する。
 * **複数インスタンスで動かすなら Redis 実装が要る**(メモリ実装は
 * プロセスごとに数えるため、台数分だけ上限が緩くなる)。
 *
 * 含まないもの: `createRedisStore`(ioredis。サーバ専用)。
 *
 * @packageDocumentation
 */
export { createRateLimiter, type RateLimiter, type RateLimiterConfig } from "./limiter";
export { createMemoryStore } from "./memory";
export type { RateLimitStore, RateLimitResult } from "./types";
