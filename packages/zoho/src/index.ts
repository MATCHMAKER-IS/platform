/**
 * `@platform/zoho` — Zoho 連携。サービス別サブパッケージ(subpath exports)。
 * - `/core` DC/OAuth/共通クライアント
 * - `/crm` CRM(v8) / `/books` Books(v3) / `/desk` Desk(v1) / `/inventory` Inventory(v1)
 * - `/campaigns` Campaigns(v1.1) / `/projects` Projects / `/people` People
 * @packageDocumentation
 */
export * from "./core/index.js";
export { createZohoCrmClient, type ZohoCrmClient } from "./crm/index.js";
export { createZohoBooksClient, type ZohoBooksClient } from "./books/index.js";
export { createZohoDeskClient, type ZohoDeskClient } from "./desk/index.js";
export { createZohoInventoryClient, type ZohoInventoryClient } from "./inventory/index.js";
export { createZohoCampaignsClient, type ZohoCampaignsClient } from "./campaigns/index.js";
export { createZohoProjectsClient, type ZohoProjectsClient } from "./projects/index.js";
export { createZohoPeopleClient, type ZohoPeopleClient } from "./people/index.js";
export { createZohoSignClient, type ZohoSignClient } from "./sign/index.js";
export { createZohoRecruitClient, type ZohoRecruitClient } from "./recruit/index.js";
export { createZohoWorkDriveClient, type ZohoWorkDriveClient } from "./workdrive/index.js";
export { createZohoAnalyticsClient, type ZohoAnalyticsClient } from "./analytics/index.js";
export { createZohoCliqClient, type ZohoCliqClient } from "./cliq/index.js";
export { createZohoCreatorClient, type ZohoCreatorClient } from "./creator/index.js";
export { createZohoBookingsClient, type ZohoBookingsClient } from "./bookings/index.js";
export { refreshAccessToken } from "./core/login.js";
