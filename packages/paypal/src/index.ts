/**
 * `@platform/paypal` — PayPal 決済クライアント(Orders v2)。
 *
 * client_id / client_secret から自動でアクセストークンを取得・キャッシュし、
 * 注文の作成・取得・キャプチャ・返金を型付きで扱う。live / sandbox を切替可能。
 * 認証情報の管理はアプリ側の責務。
 *
 * ベース: https://api-m.paypal.com(live) / https://api-m.sandbox.paypal.com(sandbox)
 *
 * @packageDocumentation
 */

import { encodeBase64 } from "@platform/bytes";
import { createApiClient } from "@platform/integrations";
import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** PayPal クライアント設定。 */
export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  /** 実行環境(既定: "live")。 */
  /** 接続先(既定 `sandbox`)。**本番は `live` を明示すること**。 */
  environment?: "live" | "sandbox";
  /**
   * fetch の実装(テスト・デモで差し替える)。
   *
   * **`globalThis.fetch` を書き換えないこと。** その方法だと同じプロセスの
   * 他の通信まで奪ってしまう。ここに渡せば、このクライアントの中だけで済む。
   */
  fetchImpl?: typeof fetch;
}

/** PayPal クライアント。 */
export interface PayPalClient {
  /** 注文を作成する(Orders v2)。返り値に承認用リンクが含まれる。 */
  createOrder(body: Record<string, unknown>): Promise<Result<{ id: string; status: string; links?: unknown[] }>>;
  /** 注文詳細を取得する。 */
  getOrder(orderId: string): Promise<Result<unknown>>;
  /** 承認済み注文の支払いをキャプチャする。 */
  captureOrder(orderId: string): Promise<Result<unknown>>;
  /** キャプチャ済み支払いを返金する(amount 省略で全額)。 */
  refundCapture(captureId: string, amount?: { currency_code: string; value: string }): Promise<Result<unknown>>;
}

function baseUrl(env: "live" | "sandbox"): string {
  return env === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}

/**
 * PayPal クライアントを作る。アクセストークンは内部で取得・キャッシュされる。
 * @param config clientId / clientSecret / environment
 * @returns {@link PayPalClient}
 *
 * @example
 * ```ts
 * const paypal = createPayPalClient({ clientId, clientSecret, environment: "sandbox" });
 * const order = await paypal.createOrder({
 *   intent: "CAPTURE",
 *   purchase_units: [{ amount: { currency_code: "JPY", value: "1000" } }],
 * });
 * ```
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — API がエラーを返した場合
 */
export function createPayPalClient(config: PayPalConfig): PayPalClient {
  // **既定は sandbox。本番は明示的に指定させる。**
  // 2026-08 まで既定が `live` で、開発中に渡し忘れると**本番の PayPal に繋がる**
  // ——本番の鍵が環境変数にある構成では、**実際に決済が走る**。
  // 「指定を忘れた」が本番事故になる既定にしない。
  const env = config.environment ?? "sandbox";
  const base = baseUrl(env);
  const doFetch = config.fetchImpl ?? fetch;
  const api = createApiClient({ baseUrl: base, ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}) });

  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<Result<string>> {
    if (token && token.expiresAt > Date.now() + 30_000) return { ok: true, value: token.value };
    // **`btoa` は非 ASCII で例外を投げる。** 認証情報は通常 ASCII だが、
    // **設定を間違えて日本語が混ざると `Invalid character` で落ちる**
    // ——原因が分かりにくいので `@platform/bytes` に寄せた(2026-08)
    const basic = encodeBase64(`${config.clientId}:${config.clientSecret}`);
    const res = await tryCatch(async () => {
      const r = await doFetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      if (!r.ok) throw new Error(`token endpoint ${r.status}`);
      return (await r.json()) as { access_token: string; expires_in: number };
    });
    if (!res.ok) {
      return { ok: false, error: new AppError(ErrorCode.EXTERNAL, "PayPalトークン取得に失敗しました", { cause: res.error.cause ?? res.error }) };
    }
    token = { value: res.value.access_token, expiresAt: Date.now() + res.value.expires_in * 1000 };
    return { ok: true, value: token.value };
  }

  async function authed(): Promise<Result<Record<string, string>>> {
    const t = await getToken();
    return t.ok ? { ok: true, value: { Authorization: `Bearer ${t.value}` } } : t;
  }

  return {
    async createOrder(body) {
      const h = await authed();
      if (!h.ok) return h;
      return api.post("/v2/checkout/orders", { headers: h.value, body });
    },
    async getOrder(orderId) {
      const h = await authed();
      if (!h.ok) return h;
      return api.get(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { headers: h.value });
    },
    async captureOrder(orderId) {
      const h = await authed();
      if (!h.ok) return h;
      return api.post(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { headers: h.value, body: {} });
    },
    async refundCapture(captureId, amount) {
      const h = await authed();
      if (!h.ok) return h;
      return api.post(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
        headers: h.value,
        body: amount ? { amount } : {},
      });
    },
  };
}
