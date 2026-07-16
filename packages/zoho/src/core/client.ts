/**
 * Zoho 共通 API クライアント(Zoho-oauthtoken 認証 + fetch 注入)。
 * @packageDocumentation
 */
import { createApiClient, type ApiClient } from "@platform/integrations";

/** 共通クライアント設定。 */
export interface ZohoClientConfig {
  /** API ドメイン(例: "https://www.zohoapis.jp")。 */
  apiDomain: string;
  /** アクセストークン。 */
  accessToken: string;
  /** ベースパス(例: "/crm/v8", "/books/v3")。 */
  basePath: string;
  /** 全リクエストに付与する既定クエリ(例: Books の organization_id)。 */
  defaultQuery?: Record<string, string | number | undefined>;
  /** 追加ヘッダ(例: Zoho Desk の orgId)。 */
  extraHeaders?: Record<string, string>;
  /** fetch 差し替え(テスト用)。 */
  fetchImpl?: typeof fetch;
}

/**
 * Zoho 用の API クライアントを作る。
 *
 * 認証ヘッダは `Zoho-oauthtoken`(**`Bearer` ではない**。Zoho 独自)。
 *
 * @param options.tokenManager トークンマネージャ(自動更新される)
 * @param options.service サービス
 * @param options.dc データセンター
 * @returns API クライアント
 */
export function createZohoApiClient(config: ZohoClientConfig): ApiClient {
  return createApiClient({
    baseUrl: `${config.apiDomain.replace(/\/$/, "")}${config.basePath}`,
    headers: { Authorization: `Zoho-oauthtoken ${config.accessToken}`, ...config.extraHeaders },
    defaultQuery: config.defaultQuery,
    fetchImpl: config.fetchImpl,
  });
}
