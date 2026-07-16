/**
 * OTLP(OpenTelemetry Protocol)互換のスパンエクスポータ。
 * 完了スパンをバッファし、一定間隔/一定量でまとめて Collector(Jaeger/Tempo/Datadog 等)へ HTTP 送信する。
 * 依存ゼロを保つため fetch を注入する。SpanExporter として createTracer に渡せる。
 * @packageDocumentation
 */
import type { Span, SpanExporter } from "./trace.js";

/** {@link createOtlpExporter} のオプション。 */
export interface OtlpExporterOptions {
  /** OTLP HTTP エンドポイント(例: "http://collector:4318/v1/traces")。 */
  endpoint: string;
  /** サービス名(resource attribute)。 */
  serviceName: string;
  /** この件数たまったら即フラッシュ(既定 100)。 */
  maxBatchSize?: number;
  /** この間隔(ms)で定期フラッシュ(既定 5000)。 */
  flushIntervalMs?: number;
  /** 追加ヘッダ(認証トークン等)。 */
  headers?: Record<string, string>;
  /** fetch 実装(既定はグローバル)。 */
  fetchImpl?: typeof fetch;
  /** タイマ設定(テスト用)。 */
  scheduler?: (cb: () => void, ms: number) => unknown;
  clearScheduler?: (id: unknown) => void;
  /** 送信失敗時のコールバック(監視・ログ用)。 */
  onError?: (error: unknown, dropped: number) => void;
}

/** バッチ送信つきの OTLP エクスポータハンドル。 */
export interface OtlpExporter {
  /** SpanExporter として tracer に渡す関数。 */
  readonly export: SpanExporter;
  /** 手動フラッシュ(shutdown 時に呼ぶ)。 */
  flush(): Promise<void>;
  /** 定期フラッシュを停止(shutdown 時)。 */
  stop(): void;
  /** 未送信件数。 */
  pending(): number;
}

/** Span を OTLP JSON の span 形へ変換(最小マッピング)。 */
function toOtlpSpan(s: Span): Record<string, unknown> {
  return {
    traceId: s.traceId,
    spanId: s.spanId,
    ...(s.parentSpanId ? { parentSpanId: s.parentSpanId } : {}),
    name: s.name,
    startTimeUnixNano: Math.round(s.startTime * 1e6),
    ...(s.endTime ? { endTimeUnixNano: Math.round(s.endTime * 1e6) } : {}),
    attributes: Object.entries(s.attributes).map(([key, value]) => ({ key, value: { stringValue: String(value) } })),
    status: { code: s.status === "error" ? 2 : 1, ...(s.error ? { message: s.error } : {}) },
  };
}

/**
 * OTLP エクスポータを作る(OpenTelemetry の標準形式で送信)。
 *
 * **送信の失敗はアプリを止めない**(監視のために本業が止まっては本末転倒)。
 *
 * @param options.endpoint 送信先の URL
 * @param options.headers 認証ヘッダなど
 * @param options.fetchImpl fetch の実装(テスト注入用)
 * @returns エクスポータ
 * @throws なし — **送信に失敗してもアプリを止めない**(監視のために本業が止まっては本末転倒)
 */
export function createOtlpExporter(options: OtlpExporterOptions): OtlpExporter {
  const maxBatchSize = options.maxBatchSize ?? 100;
  const flushIntervalMs = options.flushIntervalMs ?? 5000;
  const doFetch = options.fetchImpl ?? (globalThis.fetch as typeof fetch);
  const scheduler = options.scheduler ?? ((cb, ms) => setInterval(cb, ms));
  const clearScheduler = options.clearScheduler ?? ((id) => clearInterval(id as never));

  let buffer: Span[] = [];
  let timer: unknown = scheduler(() => void flush(), flushIntervalMs);

  async function send(spans: Span[]): Promise<void> {
    const body = JSON.stringify({
      resourceSpans: [{
        resource: { attributes: [{ key: "service.name", value: { stringValue: options.serviceName } }] },
        scopeSpans: [{ spans: spans.map(toOtlpSpan) }],
      }],
    });
    try {
      const res = await doFetch(options.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
        body,
      });
      if (!res.ok) throw new Error(`OTLP export failed: ${res.status}`);
    } catch (e) {
      options.onError?.(e, spans.length); // 失敗分は破棄(監視のため通知)。無限バッファ肥大を防ぐ。
    }
  }

  async function flush(): Promise<void> {
    if (buffer.length === 0) return;
    const batch = buffer;
    buffer = [];
    await send(batch);
  }

  return {
    export: (span: Span) => {
      buffer.push(span);
      if (buffer.length >= maxBatchSize) void flush();
    },
    flush,
    stop: () => clearScheduler(timer),
    pending: () => buffer.length,
  };
}
