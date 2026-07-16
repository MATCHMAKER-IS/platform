/**
 * `@platform/core` — 基盤全体で共有するエラー規約と Result 型。
 * すべての基盤パッケージはここに依存し、失敗の表現を統一する。
 * @packageDocumentation
 */
export { AppError, ErrorCode } from "./error";
export { ERROR_POLICY, httpStatusFor, isRetryable, isPermanent, defaultShouldRetry, toErrorEnvelope, type ErrorPolicy, type ErrorEnvelope } from "./error-policy";
export { ok, err, tryCatch, type Result, type Ok, type Err } from "./result";
export { createLifecycle, type Lifecycle, type ShutdownHook, type LifecycleOptions } from "./lifecycle";
export { installProcessGuards, type ProcessGuardOptions } from "./process-guard";
export { createBulkhead, type Bulkhead, type BulkheadOptions } from "./bulkhead";
