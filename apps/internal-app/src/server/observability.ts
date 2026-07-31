/**
 * アプリ全体で共有する観測性インスタンス(トレーサ + メトリクス)。
 * トレースはログに出力(実運用では OTLP エクスポータ等へ差し替え)。
 * @packageDocumentation
 */
import { createTracer, createMetrics, type Span } from "@platform/observability";
import { log } from "./services";

/** メトリクスレジストリ(/api/metrics で公開)。 */
export const metrics = createMetrics();

/** 完了スパンをログへ(構造化)。 */
const exportSpan = (span: Span) => {
  // **pino 流儀: (obj, msg) の順。** メッセージを第 1 引数に書くと型が合わない
  log.info({
    traceId: span.traceId, spanId: span.spanId, parentSpanId: span.parentSpanId,
    name: span.name, durationMs: span.durationMs, status: span.status, ...(span.error ? { error: span.error } : {}),
  }, "trace");
};

/** アプリ共有トレーサ。 */
export const tracer = createTracer(exportSpan);
