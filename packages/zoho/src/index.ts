/**
 * `@platform/zoho` — Zoho 連携。サービス別サブパッケージ(subpath exports)。
 * - `/core` DC/OAuth/共通クライアント
 * - `/mail` Mail(v1) / `/meeting` Meeting(v2) / `/expense` Expense(v1) / `/vault` Vault(v1)
 * - `/crm` CRM(v8) / `/books` Books(v3) / `/desk` Desk(v1) / `/inventory` Inventory(v1)
 * - `/campaigns` Campaigns(v1.1) / `/projects` Projects / `/people` People
 *
 * 【連携するときに必ず確かめること】
 *
 * **① データセンターを間違えない。** Zoho は DC ごとに URL が違う
 * (日本は `.jp`、米国は `.com`)。**間違えると認証は通るが空の結果が返る**
 * ——「データが無い」ように見えて、実際は**別の DC を見ている**。
 * `detectDataCenter` は不明なら `com` を返すので、**日本の組織では明示すること**。
 *
 * **② 日時はタイムゾーン付きで返る。** Zoho は組織の設定した TZ で
 * `2026-08-10T09:00:00+09:00` のように返す——**`slice(0, 10)` で日付を切らない**。
 * UTC に直してから切ると **JST の朝が前日**になる。
 * `@platform/datetime` の JST 変換を通すこと。
 *
 * **③ API の呼び出し数に上限がある。** 1 分・1 日の両方で数えられ、
 * 超えると 429 が返る(`@platform/integrations` が `Retry-After` を見て待つ)。
 * **一括同期では普通に当たる**ので、夜間に回すか件数を分けること。
 *
 * **④ カスタム項目は API 名が違う。** 画面の表示名ではなく
 * `Custom_Field_1` のような内部名で返る。**表示名で書くと動かない**。
 *
 * @packageDocumentation
 */
export * from "./core/index";
export { createZohoCrmClient, type ZohoCrmClient } from "./crm/index";
export { createZohoMailClient, type ZohoMailClient, type ZohoMailAccount, type ZohoMailMessage, type ZohoMailSendInput } from "./mail/index";
export { createZohoMeetingClient, type ZohoMeetingClient, type ZohoMeeting, type ZohoMeetingCreateInput } from "./meeting/index";
export { createZohoExpenseClient, type ZohoExpenseClient, type ZohoExpense, type ZohoExpenseReport, type ZohoExpenseCreateInput } from "./expense/index";
export { createZohoVaultClient, type ZohoVaultClient, type ZohoVaultSecretSummary, type ZohoVaultSecretDetail } from "./vault/index";
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
