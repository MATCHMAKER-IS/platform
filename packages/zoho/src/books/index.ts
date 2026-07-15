/**
 * `@platform/zoho/books` — Zoho Books API(v3)クライアント。
 * organization_id を全リクエストに付与。invoices / contacts / items に対応。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient, type ZohoClientConfig } from "../core/client.js";

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

/** Zoho Books クライアントを作る。organizationId は必須。 */
export function createZohoBooksClient(config: Omit<ZohoClientConfig, "basePath" | "defaultQuery"> & { organizationId: string }): ZohoBooksClient {
  const { organizationId, ...rest } = config;
  const api = createZohoApiClient({ ...rest, basePath: "/books/v3", defaultQuery: { organization_id: organizationId } });
  const enc = encodeURIComponent;
  return {
    listOrganizations: () => api.get(`/organizations`),
    listInvoices: (params) =>
      api.get(`/invoices`, { query: { page: params?.page, per_page: params?.perPage, status: params?.status, customer_id: params?.customerId } }),
    getInvoice: (id) => api.get(`/invoices/${enc(id)}`),
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
