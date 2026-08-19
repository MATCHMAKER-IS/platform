/**
 * API ハンドラを観測性で包む。トレーススパン + リクエスト数/レイテンシ/エラー率を記録し、
 * traceId を相関コンテキストに束ねてログと突合可能にする。
 * Next の `(req)` / `(req, ctx)` / `NextRequest` / 同期・非同期のいずれにも対応。
 * @packageDocumentation
 */
import { parseTraceparent } from "@platform/observability";
import { toErrorEnvelope, httpStatusFor, AppError } from "@platform/core";
import { getWriteLimiter, writeLimitKey } from "./rate-limit";
import { tracer, metrics } from "./observability";
import { logContext } from "./log-context";
import { debugCollector } from "./debug-collector";

// 第1引数は Request 互換(NextRequest 含む)。戻りは Response|Promise<Response>。
type AnyHandler<A extends [Request, ...unknown[]]> = (...args: A) => Response | Promise<Response>;

/**
 * 受け取る本文の上限(バイト)。
 *
 * **1MB。** 業務の入力としては十分すぎる大きさで、
 * これを超えるならファイルとして扱うべきもの。
 * ファイルの受け口は別に上限を持つ(20MB)。
 */
const MAX_BODY_BYTES = 1_000_000;

export function withApiObservability<A extends [Request, ...unknown[]]>(route: string, handler: AnyHandler<A>): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    const req = args[0];
    const method = req.method;

    // **書き込みの守りは入口に置く。**
    // 226 本の API に個別に書くと必ず漏れる。実際、ログインだけが
    // Origin を確かめており、他は無防備だった(2026-08 に気づいた)。
    if (method !== "GET" && method !== "HEAD") {
      // **本文の大きさ。** 巨大な JSON を送られると解析でメモリを食う。
      // 検証は解析の後なので、その前に止める必要がある
      // **ファイルの受け口は除く。** そちらは 20MB まで受ける
      // (`handleUpload` が自分で上限を持つ)
      const isUpload = route.includes("/files/upload") || route.includes("/attachments");
      const length = Number(req.headers.get("content-length") ?? "0");
      if (!isUpload && Number.isFinite(length) && length > MAX_BODY_BYTES) {
        return Response.json({ error: "送信された内容が大きすぎます" }, { status: 413 });
      }

      // **同一サイトからの要求だけを受ける(CSRF 対策)。**
      // `Origin` はブラウザが管理するので偽装できない。
      // 送ってこない相手(サーバ間の呼び出しなど)は通す — 送られたときだけ見る
      const origin = req.headers.get("origin");
      if (origin !== null && origin !== new URL(req.url).origin) {
        return Response.json({ error: "不正な要求です" }, { status: 403 });
      }

      // **`Content-Type` を確かめる。**
      // `text/plain` や `application/x-www-form-urlencoded` は
      // ブラウザが**事前確認(preflight)なしで送れる**ため、
      // 他所のページから JSON を投げ込める。
      // `application/json` を求めれば preflight が必須になり、
      // `Origin` の確認と合わせて二重の守りになる。
      //
      // ファイルの受け口(multipart)は除く
      const ctype = req.headers.get("content-type") ?? "";
      const isForm = ctype.startsWith("multipart/form-data");
      if (!isUpload && !isForm && ctype !== "" && !ctype.startsWith("application/json")) {
        return Response.json(
          { error: "Content-Type は application/json を指定してください" },
          { status: 415 },
        );
      }

      // **回数を制限する。** 認証があっても、正規の利用者が
      // スクリプトで叩けば同じ。誤ったループやリトライの暴走を止める。
      // **ストアが落ちたら通す**(制限のせいで業務が止まる方が困る)
      const hit = await getWriteLimiter().check(writeLimitKey(req));
      if (hit.ok && !hit.value.allowed) {
        return Response.json(
          { error: "操作が多すぎます。しばらくしてからお試しください" },
          { status: 429, headers: { "retry-after": "60" } },
        );
      }
    }

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
        // **成功時も追跡できるようにする。**
        // 「さっきの操作が変だった」と言われたとき、
        // この値でログを引ける。例外時だけだと、
        // **「動いたが結果がおかしい」場合に照合できない**
        res.headers.set("x-request-id", span.traceId);
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
        return Response.json(envelope, {
          status,
          headers: { "x-request-id": span.traceId },
        });
      } finally {
        metrics.observeHistogram("http_request_duration_ms", Date.now() - start, { route });
        span.end();
      }
    });
  };
}
