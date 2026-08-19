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
import { getContext, getRequestId, runWithContext } from "@platform/context";
import { guardWrite } from "@platform/guard";
// **制限器は `rate-limit.ts` にある。** 2026-08 に `guardWrite` を
// `@platform/guard` へ寄せた際、ここの import を付け忘れており、
// `getWriteLimiter` / `MAX_BODY_BYTES` が未定義のまま残っていた
// (**雛形なので、コピーされた新規アプリ全部に伝播する**)。
import { getWriteLimiter } from "./rate-limit";
import { createMetrics, createTracer } from "@platform/observability";
import { toErrorEnvelope, httpStatusFor, AppError } from "@platform/core";
import type { AuditEvent } from "@platform/audit";

/** 相関ID を運ぶヘッダ名。**受けるときも返すときも同じ名前**を使う。 */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * 受け付ける本文の上限(1MB)。
 *
 * **これが無いと、巨大な本文を送られただけでメモリを食う。**
 * 画面からの登録・更新でこれを超えるものは無い(ファイルは
 * `@platform/upload` の経路で別に受ける)。
 */
export const MAX_BODY_BYTES = 1_000_000;

/**
 * ログ。秘密情報(password / token / email など)は基盤側で自動的に伏せられる。
 *
 * `contextProvider` に `@platform/context` を差してあるので、`withApi` の中で出した
 * ログには **requestId / userId が自動で乗る**。個々の呼び出しで `log.info({ requestId })`
 * と書く必要はない —— 書かせると必ずどこかで抜け、抜けた行だけ追えなくなる。
 */
export const logger = createLogger({
  base: { service: "crud-template" },
  contextProvider: () => getContext() ?? {},
});

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
  // requestId は contextProvider が自動で乗せるので、ここでは業務側の情報だけ書く。
  logger.info({ actor: event.actor, action: event.action, target: event.target }, "audit");
}

/** 監査ログの参照(管理画面などから使う)。 */
export function listAudit(): readonly AuditEvent[] {
  return auditEntries;
}

type Handler = (req: Request, ctx?: unknown) => Response | Promise<Response>;

/** 相関ID として受け入れる形。**上流から来た値をそのままログに流さない**ための関門。 */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * 上流(ロードバランサ・呼び出し元アプリ)が付けた相関ID を拾う。
 *
 * 拾うのは、**アプリをまたいで 1 つの操作を追える**ようにするため。ここで採番し直すと、
 * 「入口では追えるが、社内の別アプリを呼んだ先で切れる」状態になる。
 *
 * ただし値は検証する。改行のような不正な文字はランタイムが弾くが、**数 KB の文字列や
 * 記号だらけの値は素通りする**。そのままログの相関キーにすると、検索も集計もできない。
 * 形を絞っておけば、おかしな値は捨てて採番し直せる。
 *
 * @returns 使える相関ID。無い/形が不正なら `undefined`(呼び出し側がキーごと省く)
 */
function incomingRequestId(req: Request): string | undefined {
  const raw = req.headers.get(REQUEST_ID_HEADER);
  return raw !== null && REQUEST_ID_PATTERN.test(raw) ? raw : undefined;
}

/**
 * 応答に相関ID を載せる。
 *
 * **利用者から「エラーが出た」と言われたときの手掛かり**になる。画面やレスポンスに
 * 出ている ID をそのまま伝えてもらえば、サーバのログを 1 件に絞り込める。
 *
 * ヘッダを直接 `set()` しないのは、`fetch()` 由来の Response が immutable で例外に
 * なるため。詰め替えれば、ハンドラが何を返しても壊れない。
 */
function withRequestId(res: Response): Response {
  const id = getRequestId();
  if (id === undefined) return res;
  const headers = new Headers(res.headers);
  headers.set(REQUEST_ID_HEADER, id);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

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
    // 上流の ID が無いときはキーごと渡さない。runWithContext は
    // `requestId: undefined` でも採番するが、渡さない方が意図が読める
    const upstream = incomingRequestId(req);
    const seed = { route, method: req.method, ...(upstream !== undefined && { requestId: upstream }) };

    // コンテキストはここで張る。**入口が 1 つ**なので、ルートが増えても付け忘れが起きない。
    return runWithContext(seed, async () => {
      // **書き込みだけ回数を制限する。**
      // ここに置けば、ルートが増えても付け忘れない。
      // 読み取りは副作用が無く遅くなるだけなので対象外。
      //
      // **同一サイトからの要求だけを受ける(CSRF 対策)。**
      // 他所のページから勝手に書き込ませる攻撃を防ぐ。
      // `Origin` はブラウザが管理するので偽装できない。
      // 送ってこない相手(古いクライアント)は通す — 送られたときだけ見る。
      // **書き込みの共通ガード**(本文サイズ・CSRF・レート制限)は
      // `@platform/guard` の `guardWrite` に移した(2026-08)。
      // 3 つとも「書き忘れても動いてしまう」ので、**アプリごとに書かない**
      // ——`line-console` にも同じ実装があった。
      const blocked = await guardWrite(req, { limiter: getWriteLimiter(), maxBodyBytes: MAX_BODY_BYTES });
      if (blocked !== null) return blocked;

      const started = Date.now();
      const span = tracer.startSpan(`${req.method} ${route}`);
      try {
        const res = await handler(req, ctx);
        metrics.incrementCounter("http_requests_total", 1, { route, method: req.method, status: String(res.status) });
        metrics.observeHistogram("http_request_duration_ms", Date.now() - started, { route });
        return withRequestId(res);
      } catch (e) {
        // AppError 以外(想定外の例外)は INTERNAL として扱う
        const err = AppError.from(e);
        const status = httpStatusFor(err.code);
        metrics.incrementCounter("http_requests_total", 1, { route, method: req.method, status: String(status) });
        // 4xx は利用者の操作ミス、5xx はこちらの不具合。分けて記録する
        // route/requestId/userId は contextProvider が自動で乗せる
        if (status >= 500) logger.error({ err: err.message }, "api error");
        else logger.warn({ err: err.message }, "api rejected");
        return withRequestId(Response.json(toErrorEnvelope(err), { status }));
      } finally {
        span.end();
      }
    });
  };
}
