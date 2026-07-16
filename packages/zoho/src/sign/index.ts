/**
 * `@platform/zoho/sign` — Zoho Sign API(v1)クライアント。
 * ベースは `sign.zoho.{dc}/api/v1`。一覧系は `data={JSON}` クエリで page_context を渡す。
 * ファイルアップロードを伴う作成は multipart のためこの型付きクライアントの範囲外。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter";

/** Sign レスポンス(緩め)。 */
export type SignRecord = Record<string, unknown>;

/** 一覧の page_context。 */
export interface SignPageContext { row_count?: number; start_index?: number; search_columns?: Record<string, string>; sort_column?: string; sort_order?: "ASC" | "DESC" }

/** Sign クライアント設定。 */
export interface ZohoSignConfig { dataCenter: ZohoDataCenter; accessToken: string; fetchImpl?: typeof fetch }

/** Sign クライアント。 */
export interface ZohoSignClient {
  /** 署名リクエスト(ドキュメント)一覧。 */
  listDocuments(pageContext?: SignPageContext): Promise<Result<SignRecord>>;
  /** ドキュメント詳細。 */
  getDocument(requestId: string): Promise<Result<SignRecord>>;
  /** ドキュメント削除。 */
  deleteDocument(requestId: string): Promise<Result<unknown>>;
  /** 署名依頼のリコール(取消)。 */
  recallDocument(requestId: string): Promise<Result<unknown>>;
  /** リマインド送信。 */
  remindDocument(requestId: string): Promise<Result<unknown>>;
  /** テンプレート一覧。 */
  listTemplates(pageContext?: SignPageContext): Promise<Result<SignRecord>>;
  /** ユーザー一覧。 */
  listUsers(): Promise<Result<SignRecord>>;
}

/**
 * Zoho Sign(電子署名)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns Sign のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoSignClient(config: ZohoSignConfig): ZohoSignClient {
  const api = createZohoApiClient({ apiDomain: serviceBaseUrl("sign", config.dataCenter), basePath: "", accessToken: config.accessToken, fetchImpl: config.fetchImpl });
  const enc = encodeURIComponent;
  const dataParam = (pc?: SignPageContext) => (pc ? { data: JSON.stringify({ page_context: pc }) } : undefined);
  return {
    listDocuments: (pc) => api.get(`/requests`, { query: dataParam(pc) }),
    getDocument: (id) => api.get(`/requests/${enc(id)}`),
    deleteDocument: (id) => api.delete(`/requests/${enc(id)}`),
    recallDocument: (id) => api.post(`/requests/${enc(id)}/recall`),
    remindDocument: (id) => api.post(`/requests/${enc(id)}/remind`),
    listTemplates: (pc) => api.get(`/templates`, { query: dataParam(pc) }),
    listUsers: () => api.get(`/users`),
  };
}
