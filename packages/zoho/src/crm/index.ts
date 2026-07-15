/**
 * `@platform/zoho/crm` — Zoho CRM API(v8)クライアント。
 * レコード CRUD・検索・COQL・アップサート・一括削除に対応。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient, type ZohoClientConfig } from "../core/client.js";

/** CRM レコード(緩め）。 */
export type CrmRecord = Record<string, unknown>;

/** ページ情報。 */
export interface CrmPageInfo { per_page?: number; page?: number; count?: number; more_records?: boolean; next_page_token?: string | null; previous_page_token?: string | null }

/** CRM クライアント。 */
export interface ZohoCrmClient {
  /** モジュールのレコード一覧(fields/per_page/page/page_token/sort)。 */
  getRecords(module: string, params?: { fields?: string[]; perPage?: number; page?: number; pageToken?: string; sortBy?: string; sortOrder?: "asc" | "desc" }): Promise<Result<{ data?: CrmRecord[]; info?: CrmPageInfo }>>;
  /** ID 指定取得。 */
  getRecord(module: string, id: string, params?: { fields?: string[] }): Promise<Result<{ data?: CrmRecord[] }>>;
  /** レコード作成(最大100件)。 */
  createRecords(module: string, records: CrmRecord[], options?: { trigger?: string[] }): Promise<Result<unknown>>;
  /** ID 指定更新。 */
  updateRecord(module: string, id: string, fields: CrmRecord): Promise<Result<unknown>>;
  /** 複数レコード更新(各レコードに id を含める)。 */
  updateRecords(module: string, records: CrmRecord[]): Promise<Result<unknown>>;
  /** アップサート(重複判定フィールド指定可)。 */
  upsertRecords(module: string, records: CrmRecord[], duplicateCheckFields?: string[]): Promise<Result<unknown>>;
  /** 一括削除(最大100件)。 */
  deleteRecords(module: string, ids: string[]): Promise<Result<unknown>>;
  /** 検索(criteria / email / phone / word のいずれか)。 */
  searchRecords(module: string, query: { criteria?: string; email?: string; phone?: string; word?: string; page?: number; perPage?: number }): Promise<Result<{ data?: CrmRecord[]; info?: CrmPageInfo }>>;
  /** COQL(SELECT クエリ)。 */
  coql(selectQuery: string): Promise<Result<{ data?: CrmRecord[]; info?: CrmPageInfo }>>;
}

/** Zoho CRM クライアントを作る。 */
export function createZohoCrmClient(config: Omit<ZohoClientConfig, "basePath">): ZohoCrmClient {
  const api = createZohoApiClient({ ...config, basePath: "/crm/v8" });
  const enc = encodeURIComponent;
  return {
    getRecords: (module, params) =>
      api.get(`/${module}`, { query: { fields: params?.fields?.join(","), per_page: params?.perPage, page: params?.page, page_token: params?.pageToken, sort_by: params?.sortBy, sort_order: params?.sortOrder } }),
    getRecord: (module, id, params) =>
      api.get(`/${module}/${enc(id)}`, { query: { fields: params?.fields?.join(",") } }),
    createRecords: (module, records, options) =>
      api.post(`/${module}`, { body: { data: records, trigger: options?.trigger } }),
    updateRecord: (module, id, fields) =>
      api.put(`/${module}/${enc(id)}`, { body: { data: [fields] } }),
    updateRecords: (module, records) =>
      api.put(`/${module}`, { body: { data: records } }),
    upsertRecords: (module, records, duplicateCheckFields) =>
      api.post(`/${module}/upsert`, { body: { data: records, duplicate_check_fields: duplicateCheckFields } }),
    deleteRecords: (module, ids) =>
      api.delete(`/${module}`, { query: { ids: ids.join(",") } }),
    searchRecords: (module, query) =>
      api.get(`/${module}/search`, { query: { criteria: query.criteria, email: query.email, phone: query.phone, word: query.word, page: query.page, per_page: query.perPage } }),
    coql: (selectQuery) =>
      api.post(`/coql`, { body: { select_query: selectQuery } }),
  };
}
