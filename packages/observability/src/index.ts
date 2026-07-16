/**
 * `@platform/observability` — 依存ゼロの軽量トレーシング・メトリクス。
 * @packageDocumentation
 */
export * from "./trace";
export * from "./metrics";
export * from "./idempotency";
export * from "./health";
export * from "./circuit-breaker";
export * from "./outbox";
export { createRedisIdempotencyStore, type RedisIdempotencyClient, type AsyncIdempotencyStore } from "./idempotency-redis";
export { createSqlOutboxStore, type OutboxDbClient, type SqlOutboxStore } from "./outbox-sql";
export { createOtlpExporter, type OtlpExporter, type OtlpExporterOptions } from "./otlp";
export { createAlertManager, errorRateAbove, avgLatencyAbove, gaugeAtLeast, type AlertRule, type Alert, type AlertManager, type MetricsView, type Severity } from "./alerting";
