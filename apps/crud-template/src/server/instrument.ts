/**
 * API を「認可 + 観測 + 監査」で包むための配線。
 *
 * 3 つを個別に書くと、必ずどこかで抜ける。**1 つのラッパにまとめて**、
 * ルート側は `export const GET = withApi("/api/items", handler)` と書くだけにする。
 *
 * ここで記録するもの:
 *   - 観測(メトリクス): 何回呼ばれ、どれだけ時間がかかり、どれだけ失敗したか
 *   - ログ: 1 リクエストを追える形(requestId 付き)。秘密情報は基盤側で自動マスク
 *   - 監査: 誰が・いつ・何を変えたか(業務上あとから説明が要る操作)
 * @packageDocumentation
 */
import { createLogger } from "@platform/logger";
import { createMetrics, createTracer } from "@platform/observability";
import { toErrorEnvelope, httpStatusFor, AppError } from "@platform/core";
import type { AuditEvent } from "@platform/audit";

/** ログ。秘密情報(password / token / email など)は基盤側で自動的に伏せられる。 */
export const logger = createLogger({ base: { service: "crud-template" } });

/** メトリクス。/api/metrics などで公開すると Prometheus から読める。 */
export const metrics = createMetrics([50, 100, 300, 1000]);

/** トレース。1 リクエストの中の処理を線で追う。 */
export const tracer = createTracer((span) => {
  logger.debug({ span: span.name, durationMs: span.durationMs }, "span");
});

/**
 * 監査ログの保存先。
 *
 * **雛形はメモリ**(再起動で消える)。本番では必ず DB に差し替える。
 * 監査ログは「後から説明できること」が目的なので、消えては意味がない。
 */
const auditEntries: AuditEvent[] = [];

export function recordAudit(event: AuditEvent): void {
  auditEntries.push(event);
  logger.info({ actor: event.actor, action: event.action, target: event.target }, "audit");
}

/** 監査ログの参照(管理画面などから使う)。 */
export function listAudit(): readonly AuditEvent[] {
  return auditEntries;
}

type Handler = (req: Request, ctx?: unknown) => Response | Promise<Response>;

/**
 * API ハンドラを包む。
 *
 * - 所要時間と成否をメトリクスへ
 * - 例外を AppError の形に整えて、適切な HTTP ステータスで返す
 *   (認可の失敗が 500 になってしまう、という事故を防ぐ)
 * - 想定外の例外も握りつぶさずログに残す
 *
 * @param route ルート名(メトリクスのラベル。可変部分は含めない)
 * @param handler 実処理
 *
 * @example
 * ```ts
 * export const GET = withApi("/api/items", async (req) => {
 *   requirePermission(currentUser(req), "item:read");
 *   return Response.json({ items: await itemStore.list() });
 * });
 * ```
 */
export function withApi(route: string, handler: Handler): (req: Request, ctx?: unknown) => Promise<Response> {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    const started = Date.now();
    const span = tracer.startSpan(`${req.method} ${route}`);
    try {
      const res = await handler(req, ctx);
      metrics.incrementCounter("http_requests_total", 1, { route, method: req.method, status: String(res.status) });
      metrics.observeHistogram("http_request_duration_ms", Date.now() - started, { route });
      return res;
    } catch (e) {
      // AppError 以外(想定外の例外)は INTERNAL として扱う
      const err = AppError.from(e);
      const status = httpStatusFor(err.code);
      metrics.incrementCounter("http_requests_total", 1, { route, method: req.method, status: String(status) });
      // 4xx は利用者の操作ミス、5xx はこちらの不具合。分けて記録する
      if (status >= 500) logger.error({ route, err: err.message }, "api error");
      else logger.warn({ route, err: err.message }, "api rejected");
      return Response.json(toErrorEnvelope(err), { status });
    } finally {
      span.end();
    }
  };
}
