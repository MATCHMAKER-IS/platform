/**
 * `@platform/zoho/recruit` — Zoho Recruit API(v2)クライアント。
 * ベースは `recruit.zoho.{dc}/recruit/v2`。CRM v2 と同様のレコード操作。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter";

/** Recruit レコード(緩め)。 */
export type RecruitRecord = Record<string, unknown>;
/** ページ情報。 */
export interface RecruitPageInfo { per_page?: number; page?: number; count?: number; more_records?: boolean }

/** Recruit クライアント設定。 */
export interface ZohoRecruitConfig { dataCenter: ZohoDataCenter; accessToken: string; fetchImpl?: typeof fetch }

/** Recruit クライアント。 */
export interface ZohoRecruitClient {
  getRecords(module: string, params?: { fields?: string[]; page?: number; perPage?: number; sortBy?: string; sortOrder?: "asc" | "desc" }): Promise<Result<{ data?: RecruitRecord[]; info?: RecruitPageInfo }>>;
  getRecord(module: string, id: string): Promise<Result<{ data?: RecruitRecord[] }>>;
  createRecords(module: string, records: RecruitRecord[]): Promise<Result<unknown>>;
  updateRecord(module: string, id: string, fields: RecruitRecord): Promise<Result<unknown>>;
  deleteRecords(module: string, ids: string[]): Promise<Result<unknown>>;
  searchRecords(module: string, query: { criteria?: string; email?: string; phone?: string; word?: string; page?: number; perPage?: number }): Promise<Result<{ data?: RecruitRecord[]; info?: RecruitPageInfo }>>;
  /** 候補者一覧(Candidates モジュールの糖衣)。 */
  getCandidates(params?: { fields?: string[]; page?: number; perPage?: number }): Promise<Result<{ data?: RecruitRecord[]; info?: RecruitPageInfo }>>;
  /** 求人一覧(Job_Openings モジュールの糖衣)。 */
  getJobOpenings(params?: { fields?: string[]; page?: number; perPage?: number }): Promise<Result<{ data?: RecruitRecord[]; info?: RecruitPageInfo }>>;
}

/**
 * Zoho Recruit(採用管理)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns Recruit のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoRecruitClient(config: ZohoRecruitConfig): ZohoRecruitClient {
  const api = createZohoApiClient({ apiDomain: serviceBaseUrl("recruit", config.dataCenter), basePath: "", accessToken: config.accessToken, fetchImpl: config.fetchImpl });
  const enc = encodeURIComponent;
  const getRecords: ZohoRecruitClient["getRecords"] = (module, params) =>
    api.get(`/${module}`, { query: { fields: params?.fields?.join(","), page: params?.page, per_page: params?.perPage, sort_by: params?.sortBy, sort_order: params?.sortOrder } });
  return {
    getRecords,
    getRecord: (module, id) => api.get(`/${module}/${enc(id)}`),
    createRecords: (module, records) => api.post(`/${module}`, { body: { data: records } }),
    updateRecord: (module, id, fields) => api.put(`/${module}/${enc(id)}`, { body: { data: [fields] } }),
    deleteRecords: (module, ids) => api.delete(`/${module}`, { query: { ids: ids.join(",") } }),
    searchRecords: (module, query) => api.get(`/${module}/search`, { query: { criteria: query.criteria, email: query.email, phone: query.phone, word: query.word, page: query.page, per_page: query.perPage } }),
    getCandidates: (params) => getRecords("Candidates", params),
    getJobOpenings: (params) => getRecords("Job_Openings", params),
  };
}
