/**
 * 耐障害 Zoho クライアント基盤。
 * トークン自動更新 + サーキットブレーカー + メトリクス/トレースで外部連携を保護・可視化する。
 * 各サービスクライアント(crm/desk 等)の `fetchImpl` にこの `resilientFetch` を渡す。
 * @packageDocumentation
 */
import { createZohoTokenManager, createAuthedFetch, type ZohoDataCenter } from "@platform/zoho/core";
import { createCircuitBreaker, CircuitOpenError } from "@platform/observability";
import { createBulkhead } from "@platform/core";
import { tracer, metrics } from "./observability.js";

/** Zoho 連携の設定(通常は環境変数から)。 */
export interface ZohoClientConfig {
  dataCenter: ZohoDataCenter;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/** 設定を環境変数から読む。 */
export function zohoClientConfigFromEnv(env: Record<string, string | undefined> = process.env): ZohoClientConfig {
  return {
    dataCenter: (env.ZOHO_DC ?? "jp") as ZohoDataCenter,
    clientId: env.ZOHO_CLIENT_ID ?? "",
    clientSecret: env.ZOHO_CLIENT_SECRET ?? "",
    refreshToken: env.ZOHO_REFRESH_TOKEN ?? "",
  };
}

/** サーキットブレーカー(Zoho 全体で共有)。連続5失敗で30秒遮断。 */
const breaker = createCircuitBreaker({ failureThreshold: 5, resetTimeoutMs: 30_000, successThreshold: 2 });

/**
 * バルクヘッド: Zoho への同時リクエストを制限し、遅延時に接続/メモリを食い潰さないよう隔離。
 * 同時20件まで。待機は最大200件・5秒でバックプレッシャ(RATE_LIMITED)。
 */
const bulkhead = createBulkhead({ maxConcurrent: 20, maxQueue: 200, queueTimeoutMs: 5_000 });

/** リクエストにタイムアウトを付ける(応答なしで全体が詰まるのを防ぐ)。 */
function withRequestTimeout(init: RequestInit | undefined, timeoutMs: number): { init: RequestInit; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { init: { ...init, signal: controller.signal }, cancel: () => clearTimeout(timer) };
}

/** ブレーカーの現在状態をメトリクスへ反映(0=closed,1=half_open,2=open)。 */
function recordBreakerState(): void {
  const map = { closed: 0, half_open: 1, open: 2 } as const;
  metrics.setGauge("zoho_circuit_state", map[breaker.state()]);
}

/**
 * 耐障害 fetch を作る。トークン自動付与 + ブレーカー + メトリクス/トレース。
 * これを Zoho サービスクライアントの `fetchImpl` に渡す。
 */
export function createResilientZohoFetch(config: ZohoClientConfig): typeof fetch {
  const tokenManager = createZohoTokenManager({
    dataCenter: config.dataCenter, clientId: config.clientId,
    clientSecret: config.clientSecret, refreshToken: config.refreshToken,
  });
  const authed = createAuthedFetch(tokenManager);

  const resilient = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return tracer.withSpan("zoho.request", async (span) => {
      span.setAttribute("http.url", url);
      const start = Date.now();
      try {
        // バルクヘッド(並行制限)→ ブレーカー(遮断)→ タイムアウト付き実行の順で保護。
        const res = await bulkhead.run(() => breaker.execute(async () => {
          const t = withRequestTimeout(init, 15_000);
          try { return await authed(input, t.init); }
          finally { t.cancel(); }
        }));
        metrics.setGauge("zoho_bulkhead_active", bulkhead.active());
        metrics.incrementCounter("zoho_requests_total", 1, { status: String(res.status) });
        metrics.observeHistogram("zoho_request_duration_ms", Date.now() - start);
        recordBreakerState();
        if (res.status >= 500) span.setStatus("error", `zoho ${res.status}`);
        return res;
      } catch (e) {
        recordBreakerState();
        if (e instanceof CircuitOpenError) {
          metrics.incrementCounter("zoho_circuit_open_total", 1);
          span.setStatus("error", "circuit_open");
        } else {
          metrics.incrementCounter("zoho_requests_total", 1, { status: "error" });
          span.setStatus("error", e instanceof Error ? e.message : String(e));
        }
        throw e;
      }
    });
  }) as typeof fetch;
  return resilient;
}

/** 現在のブレーカー状態(ヘルスチェック等で参照)。 */
export function zohoBreakerState(): string { return breaker.state(); }
