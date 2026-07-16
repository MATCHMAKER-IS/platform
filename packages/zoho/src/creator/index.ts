/**
 * `@platform/zoho/creator` — Zoho Creator API(v2.1)クライアント。
 * ベースは `zohoapis.{dc}/creator/v2.1`。アプリ(owner/app)配下のレポート/フォーム操作。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter";

/** Creator レコード(緩め)。 */
export type CreatorRecord = Record<string, unknown>;

/** Creator クライアント設定。owner/app は既定値として保持(メソッドで上書き可)。 */
export interface ZohoCreatorConfig {
  dataCenter: ZohoDataCenter;
  accessToken: string;
  /** アカウント所有者名(account_owner_name)。 */
  accountOwner: string;
  /** アプリのリンク名(app_link_name)。 */
  appLinkName: string;
  fetchImpl?: typeof fetch;
}

/** Creator クライアント。 */
export interface ZohoCreatorClient {
  /** アプリ一覧(メタ)。 */
  listApplications(): Promise<Result<CreatorRecord>>;
  /** レポート(ビュー)のレコード一覧。 */
  getRecords(reportLinkName: string, params?: { criteria?: string; from?: number; limit?: number; fieldConfig?: string }): Promise<Result<CreatorRecord>>;
  /** 単一レコード取得。 */
  getRecord(reportLinkName: string, recordId: string): Promise<Result<CreatorRecord>>;
  /** フォームにレコード追加。 */
  addRecords(formLinkName: string, data: CreatorRecord | CreatorRecord[]): Promise<Result<CreatorRecord>>;
  /** レコード更新。 */
  updateRecord(reportLinkName: string, recordId: string, data: CreatorRecord): Promise<Result<CreatorRecord>>;
  /** レコード削除。 */
  deleteRecord(reportLinkName: string, recordId: string): Promise<Result<CreatorRecord>>;
  /** フォーム一覧(メタ)。 */
  listForms(): Promise<Result<CreatorRecord>>;
  /** レポート一覧(メタ)。 */
  listReports(): Promise<Result<CreatorRecord>>;
}

/**
 * Zoho Creator(ローコードアプリ)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns Creator のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoCreatorClient(config: ZohoCreatorConfig): ZohoCreatorClient {
  const api = createZohoApiClient({ apiDomain: serviceBaseUrl("creator", config.dataCenter), basePath: "", accessToken: config.accessToken, fetchImpl: config.fetchImpl });
  const enc = encodeURIComponent;
  const base = `/data/${enc(config.accountOwner)}/${enc(config.appLinkName)}`;
  const metaBase = `/meta/${enc(config.accountOwner)}/${enc(config.appLinkName)}`;
  return {
    listApplications: () => api.get(`/meta/applications`),
    getRecords: (report, p) => api.get(`${base}/report/${enc(report)}`, { query: { criteria: p?.criteria, from: p?.from, limit: p?.limit, field_config: p?.fieldConfig } }),
    getRecord: (report, id) => api.get(`${base}/report/${enc(report)}/${enc(id)}`),
    addRecords: (form, data) => api.post(`${base}/form/${enc(form)}`, { body: { data } }),
    updateRecord: (report, id, data) => api.patch(`${base}/report/${enc(report)}/${enc(id)}`, { body: { data } }),
    deleteRecord: (report, id) => api.delete(`${base}/report/${enc(report)}/${enc(id)}`),
    listForms: () => api.get(`${metaBase}/forms`),
    listReports: () => api.get(`${metaBase}/reports`),
  };
}
