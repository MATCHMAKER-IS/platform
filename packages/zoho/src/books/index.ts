/**
 * `@platform/zoho/books` — Zoho Books API(v3)クライアント。
 * organization_id を全リクエストに付与。invoices / contacts / items に対応。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient, type ZohoClientConfig } from "../core/client";

/** Books リソース(緩め)。 */
export type BooksRecord = Record<string, unknown>;

/** 一覧のページ情報。 */
export interface BooksPageContext { page?: number; per_page?: number; has_more_page?: boolean; report_name?: string }

/** リスト系の汎用ヘルパー。 */
export interface BooksListResult<T = BooksRecord> { code?: number; message?: string; page_context?: BooksPageContext; [key: string]: unknown | T[] }

/** Books クライアント。 */
export interface ZohoBooksClient {
  /** 組織一覧(organization_id 取得用。※このメソッドのみ org 不要)。 */
  listOrganizations(): Promise<Result<BooksListResult>>;
  // 請求書
  /**
   * 一覧を**全件**取る(ページングを内部で回す)。
   *
   * **Books の一覧はどれも同じ形**(`page_context.has_more_page`)なので、
   * パスを渡せば使い回せる——請求書・見積・入金・取引先。
   *
   * **これを自前で書くと 1 ページ目だけ処理する。** Books の既定は 200 件/ページで、
   * **201 件目から静かに落ちる**——月次の請求が 200 件を超えた月から
   * **集計が合わなくなる**が、原因が分かりにくい。
   *
   * **上限は 50 ページ**(最大 10,000 件)。設定ミスで全期間を引くと、
   * **相手の API 上限を使い切ってその日は他の連携も動かなくなる**。
   *
   * @param path 一覧のパス(`"/invoices"` など)
   * @param params 絞り込み(`page` は内部で管理するので渡さない)
   * @param options.key 結果を取り出すキー(既定はパスから推定。`/invoices` → `invoices`)
   * @param options.maxPages 取りに行くページ数の上限(既定 50)
   * @returns 全ページを繋げた配列
   *
   * @example
   * ```ts
   * const all = await books.listAll("/invoices", { status: "unpaid" });
   * ```
   */
  listAll(path: string, params?: Record<string, string | number | boolean | undefined>, options?: { key?: string; maxPages?: number }): Promise<Result<BooksRecord[]>>;
  listInvoices(params?: { page?: number; perPage?: number; status?: string; customerId?: string }): Promise<Result<BooksListResult>>;
  getInvoice(invoiceId: string): Promise<Result<BooksRecord>>;
  createInvoice(invoice: BooksRecord, options?: { ignoreAutoNumber?: boolean }): Promise<Result<BooksRecord>>;
  updateInvoice(invoiceId: string, invoice: BooksRecord): Promise<Result<BooksRecord>>;
  deleteInvoice(invoiceId: string): Promise<Result<unknown>>;
  emailInvoice(invoiceId: string, body: BooksRecord): Promise<Result<unknown>>;
  // 連絡先
  listContacts(params?: { page?: number; perPage?: number; contactType?: string }): Promise<Result<BooksListResult>>;
  getContact(contactId: string): Promise<Result<BooksRecord>>;
  createContact(contact: BooksRecord): Promise<Result<BooksRecord>>;
  updateContact(contactId: string, contact: BooksRecord): Promise<Result<BooksRecord>>;
  // 品目
  listItems(params?: { page?: number; perPage?: number }): Promise<Result<BooksListResult>>;
  createItem(item: BooksRecord): Promise<Result<BooksRecord>>;
}

/**
 * Zoho Books(会計・請求)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns Books のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoBooksClient(config: Omit<ZohoClientConfig, "basePath" | "defaultQuery"> & { organizationId: string }): ZohoBooksClient {
  const { organizationId, ...rest } = config;
  const api = createZohoApiClient({ ...rest, basePath: "/books/v3", defaultQuery: { organization_id: organizationId } });
  const enc = encodeURIComponent;
  return {
    listOrganizations: () => api.get(`/organizations`),
    listInvoices: (params) =>
      api.get(`/invoices`, { query: { page: params?.page, per_page: params?.perPage, status: params?.status, customer_id: params?.customerId } }),
    getInvoice: (id) => api.get(`/invoices/${enc(id)}`),
    async listAll(path, params, options) {
      // **上限を設ける。** 全期間を引くと相手の API 上限を使い切る
      const maxPages = options?.maxPages ?? 50;
      // **結果のキーはパスから推定**(`/invoices` → `invoices`)。
      // Books は `{ invoices: [...] }` の形で返す
      const key = options?.key ?? path.replace(/^\//, "").split("/")[0] ?? "";
      const out: BooksRecord[] = [];
      for (let page = 1; page <= maxPages; page += 1) {
        const res = await api.get<BooksListResult>(path, { query: { ...params, page } });
        if (!res.ok) return res;
        const rows = res.value[key];
        if (Array.isArray(rows)) out.push(...(rows as BooksRecord[]));
        // **`has_more_page` が false なら終わり。** ここを見ないと
        // 1 ページ目だけ処理して「件数が合わない」ことになる
        if (res.value.page_context?.has_more_page !== true) return { ok: true, value: out };
      }
      return { ok: true, value: out };
    },
    createInvoice: (invoice, options) =>
      api.post(`/invoices`, { body: invoice, query: options?.ignoreAutoNumber ? { ignore_auto_number_generation: "true" } : undefined }),
    updateInvoice: (id, invoice) => api.put(`/invoices/${enc(id)}`, { body: invoice }),
    deleteInvoice: (id) => api.delete(`/invoices/${enc(id)}`),
    emailInvoice: (id, body) => api.post(`/invoices/${enc(id)}/email`, { body }),
    listContacts: (params) =>
      api.get(`/contacts`, { query: { page: params?.page, per_page: params?.perPage, contact_type: params?.contactType } }),
    getContact: (id) => api.get(`/contacts/${enc(id)}`),
    createContact: (contact) => api.post(`/contacts`, { body: contact }),
    updateContact: (id, contact) => api.put(`/contacts/${enc(id)}`, { body: contact }),
    listItems: (params) => api.get(`/items`, { query: { page: params?.page, per_page: params?.perPage } }),
    createItem: (item) => api.post(`/items`, { body: item }),
  };
}
