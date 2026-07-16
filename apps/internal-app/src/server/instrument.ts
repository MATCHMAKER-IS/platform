/**
 * API ハンドラを観測性で包む。トレーススパン + リクエスト数/レイテンシ/エラー率を記録し、
 * traceId を相関コンテキストに束ねてログと突合可能にする。
 * Next の `(req)` / `(req, ctx)` / `NextRequest` / 同期・非同期のいずれにも対応。
 * @packageDocumentation
 */
import { parseTraceparent } from "@platform/observability";
import { toErrorEnvelope, httpStatusFor, AppError } from "@platform/core";
import { tracer, metrics } from "./observability";
import { logContext } from "./log-context";
import { debugCollector } from "./debug-collector";

// 第1引数は Request 互換(NextRequest 含む)。戻りは Response|Promise<Response>。
type AnyHandler<A extends [Request, ...unknown[]]> = (...args: A) => Response | Promise<Response>;

/** ルート名(メトリクスのラベル)を渡して handler を計装する。 */
export function withApiObservability<A extends [Request, ...unknown[]]>(route: string, handler: AnyHandler<A>): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    const req = args[0];
    const method = req.method;
    const tp = req.headers.get("traceparent");
    const parent = tp ? parseTraceparent(tp) : null;
    const span = tracer.startSpan(`${method} ${route}`, {
      parent: parent ? { traceId: parent.traceId, spanId: parent.spanId } : undefined,
      attributes: { "http.method": method, "http.route": route },
    });
    const start = Date.now();
    // Platform Debugger(開発時のみ。本番は enabled:false で何もしない)
    debugCollector.start({ requestId: span.traceId, method, path: route });
    return logContext.run({ traceId: span.traceId, spanId: span.spanId, route, method }, async () => {
      try {
        const res = await handler(...args);
        span.setAttribute("http.status_code", res.status);
        span.setStatus(res.status >= 500 ? "error" : "ok");
        metrics.incrementCounter("http_requests_total", 1, { route, method, status: String(res.status) });
        debugCollector.finish(span.traceId, res.status);
        return res;
      } catch (e) {
        // 例外を標準エラーエンベロープに変換して返す(Next 既定の 500 画面を避け、traceId を返す)。
        // AuthzError 等の数値 status を持つ例外はそのステータスを尊重する。
        const status = e instanceof AppError ? httpStatusFor(e) : (typeof (e as { status?: unknown }).status === "number" ? (e as { status: number }).status : 500);
        const envelope = toErrorEnvelope(e, span.traceId);
        span.setAttribute("http.status_code", status);
        span.setStatus(status >= 500 ? "error" : "ok", e instanceof Error ? e.message : String(e));
        metrics.incrementCounter("http_requests_total", 1, { route, method, status: String(status) });
        if (status >= 500) metrics.incrementCounter("http_errors_total", 1, { route, method });
        debugCollector.finish(span.traceId, status);
        return Response.json(envelope, { status });
      } finally {
        metrics.observeHistogram("http_request_duration_ms", Date.now() - start, { route });
        span.end();
      }
    });
  };
}
