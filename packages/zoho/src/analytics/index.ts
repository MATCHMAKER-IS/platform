/**
 * `@platform/zoho/analytics` — Zoho Analytics API(v2)クライアント。
 * ベースは `analyticsapi.zoho.{dc}/restapi/v2`。組織識別は `ZANALYTICS-ORGID` ヘッダ。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client.js";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter.js";

/** Analytics レスポンス(緩め)。 */
export type AnalyticsRecord = Record<string, unknown>;

/** Analytics クライアント設定。 */
export interface ZohoAnalyticsConfig { dataCenter: ZohoDataCenter; accessToken: string; orgId: string; fetchImpl?: typeof fetch }

/** Analytics クライアント。 */
export interface ZohoAnalyticsClient {
  /** ワークスペース一覧。 */
  listWorkspaces(): Promise<Result<AnalyticsRecord>>;
  /** ワークスペース内のビュー一覧。 */
  listViews(workspaceId: string): Promise<Result<AnalyticsRecord>>;
  /** ビューのメタ。 */
  getViewDetails(workspaceId: string, viewId: string): Promise<Result<AnalyticsRecord>>;
  /** ビューデータをエクスポート(responseFormat: csv/json 等)。 */
  exportData(workspaceId: string, viewId: string, responseFormat?: "json" | "csv"): Promise<Result<AnalyticsRecord>>;
  /** 組織一覧。 */
  listOrgs(): Promise<Result<AnalyticsRecord>>;
}

/** Zoho Analytics クライアントを作る。 */
export function createZohoAnalyticsClient(config: ZohoAnalyticsConfig): ZohoAnalyticsClient {
  const api = createZohoApiClient({
    apiDomain: serviceBaseUrl("analytics", config.dataCenter),
    basePath: "",
    accessToken: config.accessToken,
    extraHeaders: { "ZANALYTICS-ORGID": config.orgId },
    fetchImpl: config.fetchImpl,
  });
  const enc = encodeURIComponent;
  const config1 = (cfg: Record<string, unknown>) => ({ CONFIG: JSON.stringify(cfg) });
  return {
    listWorkspaces: () => api.get(`/workspaces`),
    listViews: (wsId) => api.get(`/workspaces/${enc(wsId)}/views`),
    getViewDetails: (wsId, viewId) => api.get(`/workspaces/${enc(wsId)}/views/${enc(viewId)}`),
    exportData: (wsId, viewId, responseFormat = "json") => api.get(`/workspaces/${enc(wsId)}/views/${enc(viewId)}/data`, { query: { ...config1({ responseFormat }) } }),
    listOrgs: () => api.get(`/orgs`),
  };
}
