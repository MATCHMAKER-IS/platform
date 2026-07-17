/**
 * `@platform/zoho` — Zoho 連携。サービス別サブパッケージ(subpath exports)。
 * - `/core` DC/OAuth/共通クライアント
 * - `/crm` CRM(v8) / `/books` Books(v3) / `/desk` Desk(v1) / `/inventory` Inventory(v1)
 * - `/campaigns` Campaigns(v1.1) / `/projects` Projects / `/people` People
 * @packageDocumentation
 */
export * from "./core/index";
export { createZohoCrmClient, type ZohoCrmClient } from "./crm/index";
export { createZohoBooksClient, type ZohoBooksClient } from "./books/index";
export { createZohoDeskClient, type ZohoDeskClient } from "./desk/index";
export { createZohoInventoryClient, type ZohoInventoryClient } from "./inventory/index";
export { createZohoCampaignsClient, type ZohoCampaignsClient } from "./campaigns/index";
export { createZohoProjectsClient, type ZohoProjectsClient } from "./projects/index";
export { createZohoPeopleClient, type ZohoPeopleClient } from "./people/index";
export { createZohoSignClient, type ZohoSignClient } from "./sign/index";
export { createZohoRecruitClient, type ZohoRecruitClient } from "./recruit/index";
export { createZohoWorkDriveClient, type ZohoWorkDriveClient } from "./workdrive/index";
export { createZohoAnalyticsClient, type ZohoAnalyticsClient } from "./analytics/index";
export { createZohoCliqClient, type ZohoCliqClient } from "./cliq/index";
export { createZohoCreatorClient, type ZohoCreatorClient } from "./creator/index";
export { createZohoBookingsClient, type ZohoBookingsClient } from "./bookings/index";
// 実装元は ./core/oauth。以前 ./core/login にも同一実装のコピーがあり、
// export * が衝突して TS2308 になっていた(コピーの方を削除済み)。
export { refreshAccessToken } from "./core/oauth";
