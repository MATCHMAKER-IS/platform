/**
 * `@platform/zoho/campaigns` — Zoho Campaigns API(v1.1)クライアント。
 * ベースは `campaigns.zoho.{dc}/api/v1.1`。多くの操作はクエリパラメータ + resfmt=JSON。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client.js";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter.js";

/** Campaigns レスポンス(緩め)。 */
export type CampaignsRecord = Record<string, unknown>;

/** Campaigns クライアント設定。 */
export interface ZohoCampaignsConfig {
  dataCenter: ZohoDataCenter;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

/** Campaigns クライアント。 */
export interface ZohoCampaignsClient {
  /** メーリングリスト一覧。 */
  getMailingLists(params?: { range?: number; fromIndex?: number; sort?: "asc" | "desc" }): Promise<Result<CampaignsRecord>>;
  /** リストへ購読者を1件追加。 */
  listSubscribe(listKey: string, contactInfo: Record<string, string>, source?: string): Promise<Result<CampaignsRecord>>;
  /** リストから購読解除。 */
  listUnsubscribe(listKey: string, contactInfo: Record<string, string>): Promise<Result<CampaignsRecord>>;
  /** 一括で購読者を追加。 */
  addListSubscribersInBulk(listKey: string, emails: string[]): Promise<Result<CampaignsRecord>>;
  /** キャンペーン詳細。 */
  getCampaignDetails(campaignKey: string): Promise<Result<CampaignsRecord>>;
  /** キャンペーン送信。 */
  sendCampaign(campaignKey: string): Promise<Result<CampaignsRecord>>;
  /** 最近のキャンペーン一覧。 */
  getRecentCampaigns(params?: { range?: number; fromIndex?: number; status?: string }): Promise<Result<CampaignsRecord>>;
}

/**
 * Zoho Campaigns(メール配信)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns Campaigns のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoCampaignsClient(config: ZohoCampaignsConfig): ZohoCampaignsClient {
  const api = createZohoApiClient({
    apiDomain: serviceBaseUrl("campaigns", config.dataCenter),
    basePath: "",
    accessToken: config.accessToken,
    defaultQuery: { resfmt: "JSON" },
    fetchImpl: config.fetchImpl,
  });
  const contactJson = (info: Record<string, string>) => JSON.stringify(info);
  return {
    getMailingLists: (p) => api.get(`/getmailinglists`, { query: { range: p?.range, fromindex: p?.fromIndex, sort: p?.sort } }),
    listSubscribe: (listKey, contactInfo, source) => api.post(`/json/listsubscribe`, { query: { listkey: listKey, contactinfo: contactJson(contactInfo), source } }),
    listUnsubscribe: (listKey, contactInfo) => api.post(`/json/listunsubscribe`, { query: { listkey: listKey, contactinfo: contactJson(contactInfo) } }),
    addListSubscribersInBulk: (listKey, emails) => api.post(`/addlistsubscribersinbulk`, { query: { listkey: listKey, emailids: emails.join(",") } }),
    getCampaignDetails: (campaignKey) => api.get(`/getcampaigndetails`, { query: { campaignkey: campaignKey } }),
    sendCampaign: (campaignKey) => api.post(`/sendcampaign`, { query: { campaignkey: campaignKey } }),
    getRecentCampaigns: (p) => api.get(`/recentcampaigns`, { query: { range: p?.range, fromindex: p?.fromIndex, status: p?.status } }),
  };
}
