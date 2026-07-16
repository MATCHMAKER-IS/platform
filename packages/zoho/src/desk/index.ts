/**
 * `@platform/zoho/desk` — Zoho Desk API(v1)クライアント。
 * ベースは `desk.zoho.{dc}/api/v1`。組織識別は `orgId` ヘッダ。ページングは from/limit。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter";

/** Desk レコード(緩め)。 */
export type DeskRecord = Record<string, unknown>;
/** 一覧レスポンス。 */
export interface DeskListResult<T = DeskRecord> { data?: T[] }

/** Desk クライアント設定。 */
export interface ZohoDeskConfig {
  dataCenter: ZohoDataCenter;
  accessToken: string;
  /** 組織 ID(orgId ヘッダに設定)。 */
  orgId: string;
  fetchImpl?: typeof fetch;
}

/** ページングパラメータ(from は 1 始まり、limit 最大 100)。 */
export interface DeskPaging { from?: number; limit?: number }

/** Desk クライアント。 */
export interface ZohoDeskClient {
  listTickets(params?: DeskPaging & { departmentId?: string; status?: string; sortBy?: string }): Promise<Result<DeskListResult>>;
  getTicket(ticketId: string, params?: { include?: string }): Promise<Result<DeskRecord>>;
  createTicket(ticket: DeskRecord): Promise<Result<DeskRecord>>;
  updateTicket(ticketId: string, fields: DeskRecord): Promise<Result<DeskRecord>>;
  deleteTicket(ticketId: string): Promise<Result<unknown>>;
  listContacts(params?: DeskPaging): Promise<Result<DeskListResult>>;
  createContact(contact: DeskRecord): Promise<Result<DeskRecord>>;
  listAgents(params?: DeskPaging): Promise<Result<DeskListResult>>;
  listDepartments(params?: DeskPaging): Promise<Result<DeskListResult>>;
  addComment(ticketId: string, comment: DeskRecord): Promise<Result<DeskRecord>>;
  listComments(ticketId: string, params?: DeskPaging): Promise<Result<DeskListResult>>;
  listOrganizations(): Promise<Result<DeskListResult>>;
  /** チケット検索(searchStr / email / phone 等)。 */
  searchTickets(query: { searchStr?: string; email?: string; phone?: string; status?: string } & DeskPaging): Promise<Result<DeskListResult>>;
  /** チケットのスレッド一覧。 */
  listThreads(ticketId: string, params?: DeskPaging): Promise<Result<DeskListResult>>;
  /** チケットへ返信(スレッド送信)。 */
  sendReply(ticketId: string, reply: DeskRecord): Promise<Result<DeskRecord>>;
  /** チケットの添付一覧。 */
  listAttachments(ticketId: string, params?: DeskPaging): Promise<Result<DeskListResult>>;
  /** 取引先(accounts)一覧。 */
  listAccounts(params?: DeskPaging): Promise<Result<DeskListResult>>;
  /** 製品(products)一覧。 */
  listProducts(params?: DeskPaging): Promise<Result<DeskListResult>>;
  /** チケット件数。 */
  countTickets(params?: { status?: string; departmentId?: string }): Promise<Result<DeskRecord>>;
}

/**
 * Zoho Desk(問い合わせ管理)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns Desk のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoDeskClient(config: ZohoDeskConfig): ZohoDeskClient {
  const api = createZohoApiClient({
    apiDomain: serviceBaseUrl("desk", config.dataCenter),
    basePath: "",
    accessToken: config.accessToken,
    extraHeaders: { orgId: config.orgId },
    fetchImpl: config.fetchImpl,
  });
  const enc = encodeURIComponent;
  return {
    listTickets: (p) => api.get(`/tickets`, { query: { from: p?.from, limit: p?.limit, departmentId: p?.departmentId, status: p?.status, sortBy: p?.sortBy } }),
    getTicket: (id, p) => api.get(`/tickets/${enc(id)}`, { query: { include: p?.include } }),
    createTicket: (ticket) => api.post(`/tickets`, { body: ticket }),
    updateTicket: (id, fields) => api.patch(`/tickets/${enc(id)}`, { body: fields }),
    deleteTicket: (id) => api.delete(`/tickets/${enc(id)}`),
    listContacts: (p) => api.get(`/contacts`, { query: { from: p?.from, limit: p?.limit } }),
    createContact: (contact) => api.post(`/contacts`, { body: contact }),
    listAgents: (p) => api.get(`/agents`, { query: { from: p?.from, limit: p?.limit } }),
    listDepartments: (p) => api.get(`/departments`, { query: { from: p?.from, limit: p?.limit } }),
    addComment: (id, comment) => api.post(`/tickets/${enc(id)}/comments`, { body: comment }),
    listComments: (id, p) => api.get(`/tickets/${enc(id)}/comments`, { query: { from: p?.from, limit: p?.limit } }),
    listOrganizations: () => api.get(`/organizations`),
    searchTickets: (q) => api.get(`/tickets/search`, { query: { searchStr: q.searchStr, email: q.email, phone: q.phone, status: q.status, from: q.from, limit: q.limit } }),
    listThreads: (id, p) => api.get(`/tickets/${enc(id)}/threads`, { query: { from: p?.from, limit: p?.limit } }),
    sendReply: (id, reply) => api.post(`/tickets/${enc(id)}/sendReply`, { body: reply }),
    listAttachments: (id, p) => api.get(`/tickets/${enc(id)}/attachments`, { query: { from: p?.from, limit: p?.limit } }),
    listAccounts: (p) => api.get(`/accounts`, { query: { from: p?.from, limit: p?.limit } }),
    listProducts: (p) => api.get(`/products`, { query: { from: p?.from, limit: p?.limit } }),
    countTickets: (p) => api.get(`/ticketsCount`, { query: { status: p?.status, departmentId: p?.departmentId } }),
  };
}
