/**
 * `@platform/security` — Web セキュリティの共通部品。
 * セキュリティ HTTP ヘッダ(CSP/HSTS 等)と HTML サニタイズを提供する。
 * @packageDocumentation
 */
export { securityHeaders, type SecurityHeadersOptions } from "./headers";
export { sanitize, stripHtml } from "./sanitize";
export { createCsrf, assertCsrf, CSRF_COOKIE, CSRF_HEADER, type Csrf } from "./csrf";
export { createReplayGuard, createMemoryReplayStore, type ReplayGuard, type ReplayStore, type ReplayGuardOptions, type MemoryReplayStoreOptions } from "./replay";
