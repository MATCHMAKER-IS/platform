/**
 * `@platform/zoho/inventory` — Zoho Inventory API(v1)クライアント。
 * ベースは `zohoapis.{dc}/inventory/v1`。organization_id を全リクエストに付与。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client.js";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter.js";

/** Inventory リソース(緩め)。 */
export type InventoryRecord = Record<string, unknown>;
/** 一覧レスポンス。 */
export interface InventoryListResult { code?: number; message?: string; page_context?: { page?: number; per_page?: number; has_more_page?: boolean }; [key: string]: unknown }

/** Inventory クライアント設定。 */
export interface ZohoInventoryConfig {
  dataCenter: ZohoDataCenter;
  accessToken: string;
  organizationId: string;
  fetchImpl?: typeof fetch;
}

/** Inventory クライアント。 */
export interface ZohoInventoryClient {
  listItems(params?: { page?: number; perPage?: number }): Promise<Result<InventoryListResult>>;
  getItem(itemId: string): Promise<Result<InventoryRecord>>;
  createItem(item: InventoryRecord): Promise<Result<InventoryRecord>>;
  updateItem(itemId: string, item: InventoryRecord): Promise<Result<InventoryRecord>>;
  adjustStock(adjustment: InventoryRecord): Promise<Result<InventoryRecord>>;
  listSalesOrders(params?: { page?: number; perPage?: number; status?: string }): Promise<Result<InventoryListResult>>;
  createSalesOrder(order: InventoryRecord): Promise<Result<InventoryRecord>>;
  listPurchaseOrders(params?: { page?: number; perPage?: number }): Promise<Result<InventoryListResult>>;
  listContacts(params?: { page?: number; perPage?: number }): Promise<Result<InventoryListResult>>;
}

/**
 * Zoho Inventory(在庫・受発注)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns Inventory のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoInventoryClient(config: ZohoInventoryConfig): ZohoInventoryClient {
  const api = createZohoApiClient({
    apiDomain: serviceBaseUrl("inventory", config.dataCenter),
    basePath: "",
    accessToken: config.accessToken,
    defaultQuery: { organization_id: config.organizationId },
    fetchImpl: config.fetchImpl,
  });
  const enc = encodeURIComponent;
  return {
    listItems: (p) => api.get(`/items`, { query: { page: p?.page, per_page: p?.perPage } }),
    getItem: (id) => api.get(`/items/${enc(id)}`),
    createItem: (item) => api.post(`/items`, { body: item }),
    updateItem: (id, item) => api.put(`/items/${enc(id)}`, { body: item }),
    adjustStock: (adjustment) => api.post(`/inventoryadjustments`, { body: adjustment }),
    listSalesOrders: (p) => api.get(`/salesorders`, { query: { page: p?.page, per_page: p?.perPage, status: p?.status } }),
    createSalesOrder: (order) => api.post(`/salesorders`, { body: order }),
    listPurchaseOrders: (p) => api.get(`/purchaseorders`, { query: { page: p?.page, per_page: p?.perPage } }),
    listContacts: (p) => api.get(`/contacts`, { query: { page: p?.page, per_page: p?.perPage } }),
  };
}
