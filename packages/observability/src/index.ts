/**
 * `@platform/observability` — 依存ゼロの軽量トレーシング・メトリクス。
 * @packageDocumentation
 */
export * from "./trace.js";
export * from "./metrics.js";
export * from "./idempotency.js";
export * from "./health.js";
export * from "./circuit-breaker.js";
export * from "./outbox.js";
export { createRedisIdempotencyStore, type RedisIdempotencyClient, type AsyncIdempotencyStore } from "./idempotency-redis.js";
export { createSqlOutboxStore, type OutboxDbClient, type SqlOutboxStore } from "./outbox-sql.js";
export { createOtlpExporter, type OtlpExporter, type OtlpExporterOptions } from "./otlp.js";
export { createAlertManager, errorRateAbove, avgLatencyAbove, gaugeAtLeast, type AlertRule, type Alert, type AlertManager, type MetricsView, type Severity } from "./alerting.js";
