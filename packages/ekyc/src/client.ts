/**
 * eKYC(オンライン本人確認)コネクタ。TRUSTDOCK 等のベンダー API を型付きで扱う。
 *
 * 一般的な eKYC の流れ: 申込作成 → 利用者が本人確認書類・顔画像を提出 →
 * ベンダーが審査 → 判定を Webhook で通知 → 画像 URL を取得して保存。
 * この基盤は「申込・状態取得・画像URL取得」を型付きで叩くところを担い、判定ロジックや
 * mTLS での画像ダウンロード・保存はアプリ側(ベンダー要件に依存)に委ねる。
 *
 * ⚠️ 正確なエンドポイント・項目名はベンダーの API リファレンス(TRUSTDOCK は NDA 後に提供)で
 * 確認して `endpoints` で調整すること。ここでは一般的な REST 形状を既定にしている。
 * @packageDocumentation
 */
import { createApiClient } from "@platform/integrations";
import type { Result } from "@platform/core";

/** エンドポイントのパス(ベンダーに合わせて上書き可能)。 */
export interface EkycEndpoints {
  /** 申込作成(POST)。 */
  createApplication: string;
  /** 申込取得(GET・:id を置換)。 */
  getApplication: string;
  /** 申込一覧(GET)。 */
  listApplications: string;
  /** 申込取消(POST/DELETE・:id を置換)。 */
  cancelApplication: string;
  /** 画像 URL 取得(GET・:id を置換)。 */
  getImageUrls: string;
}

const DEFAULT_ENDPOINTS: EkycEndpoints = {
  createApplication: "/applications",
  getApplication: "/applications/:id",
  listApplications: "/applications",
  cancelApplication: "/applications/:id/cancel",
  getImageUrls: "/applications/:id/images",
};

/** eKYC クライアントの設定。 */
export interface EkycClientConfig {
  /** API キー(TRUSTDOCK 等)。 */
  apiKey: string;
  /** API ベース URL(ベンダー/環境ごと。sandbox / production)。 */
  baseUrl: string;
  /** 認証ヘッダ名(既定 "X-Api-Key")。Bearer 方式なら "Authorization" + apiKeyPrefix を使う。 */
  authHeader?: string;
  /** 認証値の接頭辞(例 "Bearer ")。 */
  apiKeyPrefix?: string;
  /** エンドポイントの上書き。 */
  endpoints?: Partial<EkycEndpoints>;
  fetchImpl?: typeof fetch;
}

/** eKYC クライアント。 */
export interface EkycClient {
  /** 本人確認申込を作成する。ベンダーが発行する申込 ID 等を返す。 */
  createApplication(input: Record<string, unknown>): Promise<Result<unknown>>;
  /** 申込の状態・判定を取得する。 */
  getApplication(applicationId: string): Promise<Result<unknown>>;
  /** 申込一覧を取得する。 */
  listApplications(params?: Record<string, string | number | boolean | undefined>): Promise<Result<unknown>>;
  /** 申込を取消す。 */
  cancelApplication(applicationId: string): Promise<Result<unknown>>;
  /** 提出画像の URL を取得する(実ダウンロードは mTLS 等ベンダー要件でアプリ側)。 */
  getImageUrls(applicationId: string): Promise<Result<unknown>>;
}

/** 汎用 eKYC クライアントを作る。 */
export function createEkycClient(config: EkycClientConfig): EkycClient {
  const authHeader = config.authHeader ?? "X-Api-Key";
  const authValue = (config.apiKeyPrefix ?? "") + config.apiKey;
  const api = createApiClient({
    baseUrl: config.baseUrl,
    headers: { [authHeader]: authValue },
    fetchImpl: config.fetchImpl,
  });
  const ep = { ...DEFAULT_ENDPOINTS, ...(config.endpoints ?? {}) };
  const path = (template: string, id: string) => template.replace(":id", encodeURIComponent(id));
  return {
    createApplication: (input) => api.post(ep.createApplication, { body: input }),
    getApplication: (id) => api.get(path(ep.getApplication, id)),
    listApplications: (params) => api.get(ep.listApplications, { query: params }),
    cancelApplication: (id) => api.post(path(ep.cancelApplication, id), { body: {} }),
    getImageUrls: (id) => api.get(path(ep.getImageUrls, id)),
  };
}

/** TRUSTDOCK 向けプリセット(ベース URL と認証ヘッダの既定を設定)。 */
export function createTrustdockClient(config: {
  apiKey: string;
  /** 環境。sandbox は検証用。既定 "production"。 */
  environment?: "production" | "sandbox";
  baseUrl?: string;
  endpoints?: Partial<EkycEndpoints>;
  fetchImpl?: typeof fetch;
}): EkycClient {
  // ⚠️ 実際のベース URL は契約時に案内される値を使うこと(下記は既定の雛形)。
  const baseUrl = config.baseUrl ?? (config.environment === "sandbox"
    ? "https://sandbox.api.trustdock.io/v2"
    : "https://api.trustdock.io/v2");
  return createEkycClient({
    apiKey: config.apiKey,
    baseUrl,
    authHeader: "X-Api-Key",
    ...(config.endpoints ? { endpoints: config.endpoints } : {}),
    ...(config.fetchImpl ? { fetchImpl: config.fetchImpl } : {}),
  });
}
