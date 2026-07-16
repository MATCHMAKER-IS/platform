/**
 * 軽量トレーシング(依存ゼロ)。W3C traceparent 互換の ID を発行し、
 * スパンの親子関係・所要時間・属性を記録する。エクスポータは差し替え可能。
 * @packageDocumentation
 */

/** スパン。 */
export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, unknown>;
  status: "ok" | "error";
  error?: string;
}

/** 完了スパンの送信先。 */
export type SpanExporter = (span: Span) => void;

const hex = (bytes: number) => Array.from({ length: bytes }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");

/**
 * トレース ID を生成する(16 バイトの 16 進)。
 *
 * **1 リクエストに 1 つ**。ログ・メトリクス・外部呼び出しに付けて回ることで、
 * 「この障害はどのリクエストで起きたか」を追える。
 *
 * @returns 32 文字の 16 進文字列
 */
export function newTraceId(): string { return hex(16); }
/**
 * スパン ID を生成する(8 バイトの 16 進)。
 *
 * **処理の区間ごとに 1 つ**(DB 呼び出し・外部 API など)。トレース ID の中で入れ子になる。
 *
 * @returns 16 文字の 16 進文字列
 */
export function newSpanId(): string { return hex(8); }

/**
 * W3C traceparent ヘッダを組み立てる。
 *
 * **外部サービスを呼ぶときに付ける**ことで、相手側のログとも突合できる
 * (相手も対応していれば、システムをまたいで 1 本の流れとして追える)。
 *
 * @param traceId トレース ID
 * @param spanId スパン ID
 * @param sampled サンプリング対象か(既定 true)
 * @returns `00-{traceId}-{spanId}-01` 形式
 */
export function toTraceparent(traceId: string, spanId: string, sampled = true): string {
  return `00-${traceId}-${spanId}-0${sampled ? 1 : 0}`;
}

/**
 * traceparent ヘッダを解析する。
 *
 * **他システムから呼ばれたとき**、そのトレース ID を引き継ぐために使う。
 *
 * @param header traceparent ヘッダの値
 * @returns トレース ID・スパン ID・サンプリング。**形式が不正なら undefined**
 */
export function parseTraceparent(header: string): { traceId: string; spanId: string; sampled: boolean } | null {
  const m = header.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
  if (!m) return null;
  return { traceId: m[1] as string, spanId: m[2] as string, sampled: (parseInt(m[3] as string, 16) & 1) === 1 };
}

/** トレーサ。 */
export interface Tracer {
  /** スパンを開始する(親コンテキストを渡すと子になる)。 */
  startSpan(name: string, options?: { parent?: { traceId: string; spanId: string }; attributes?: Record<string, unknown> }): ActiveSpan;
  /** 関数の実行をスパンで包む(例外時は error ステータス)。 */
  withSpan<T>(name: string, fn: (span: ActiveSpan) => Promise<T> | T, options?: { parent?: { traceId: string; spanId: string }; attributes?: Record<string, unknown> }): Promise<T>;
}

/** 実行中スパンの操作。 */
export interface ActiveSpan {
  readonly traceId: string;
  readonly spanId: string;
  setAttribute(key: string, value: unknown): void;
  setStatus(status: "ok" | "error", error?: string): void;
  end(): Span;
  /** このスパンを親とする traceparent。 */
  traceparent(): string;
}

/**
 * トレーサを作る。
 *
 * @param options.exporter 送信先(渡すとスパン終了時に送信)
 * @param options.now 時刻の取得(テスト注入用)
 * @returns トレーサ。`startSpan` で区間を開始する
 */
export function createTracer(exporter?: SpanExporter, now: () => number = () => Date.now()): Tracer {
  function startSpan(name: string, options?: { parent?: { traceId: string; spanId: string }; attributes?: Record<string, unknown> }): ActiveSpan {
    const traceId = options?.parent?.traceId ?? newTraceId();
    const spanId = newSpanId();
    const span: Span = {
      traceId, spanId, parentSpanId: options?.parent?.spanId,
      name, startTime: now(), attributes: { ...options?.attributes }, status: "ok",
    };
    return {
      traceId, spanId,
      setAttribute: (k, v) => { span.attributes[k] = v; },
      setStatus: (s, e) => { span.status = s; if (e) span.error = e; },
      traceparent: () => toTraceparent(traceId, spanId),
      end: () => {
        span.endTime = now();
        span.durationMs = span.endTime - span.startTime;
        exporter?.(span);
        return span;
      },
    };
  }
  async function withSpan<T>(name: string, fn: (span: ActiveSpan) => Promise<T> | T, options?: { parent?: { traceId: string; spanId: string }; attributes?: Record<string, unknown> }): Promise<T> {
    const span = startSpan(name, options);
    try {
      const result = await fn(span);
      span.setStatus("ok");
      return result;
    } catch (e) {
      span.setStatus("error", e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      span.end();
    }
  }
  return { startSpan, withSpan };
}
