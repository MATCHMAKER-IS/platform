/**
 * Zoho データセンター(DC)ごとのドメイン解決。
 * @packageDocumentation
 */

/** Zoho の各データセンター TLD。 */
export type ZohoDataCenter = "com" | "eu" | "in" | "com.au" | "jp" | "ca" | "com.cn" | "sa";

/** DC 一覧。 */
export const ZOHO_DATA_CENTERS: readonly ZohoDataCenter[] = ["com", "eu", "in", "com.au", "jp", "ca", "com.cn", "sa"];

/** OAuth 用の Zoho Accounts URL(DC 固有)。 */
export function accountsUrl(dc: ZohoDataCenter): string {
  return `https://accounts.zoho.${dc}`;
}

/** API 呼び出し用ドメイン(DC 固有)。トークン応答の api_domain があればそちらを優先。 */
export function apiDomain(dc: ZohoDataCenter): string {
  return `https://www.zohoapis.${dc}`;
}

/** api_domain 文字列から DC を推定する(不明は "com")。 */
export function detectDataCenter(apiDomainOrUrl: string): ZohoDataCenter {
  const m = apiDomainOrUrl.match(/zohoapis\.([a-z.]+)/);
  const tld = m?.[1];
  return (ZOHO_DATA_CENTERS as readonly string[]).includes(tld ?? "") ? (tld as ZohoDataCenter) : "com";
}

/** Zoho の対象サービス。 */
export type ZohoService = "crm" | "books" | "desk" | "inventory" | "campaigns" | "projects" | "people" | "sign" | "recruit" | "workdrive" | "analytics" | "cliq" | "creator" | "bookings";

/** サービス + DC からベース URL を解決する(サービスごとにドメイン/パスが異なる)。 */
export function serviceBaseUrl(service: ZohoService, dc: ZohoDataCenter): string {
  switch (service) {
    case "crm": return `https://www.zohoapis.${dc}/crm/v8`;
    case "books": return `https://www.zohoapis.${dc}/books/v3`;
    case "inventory": return `https://www.zohoapis.${dc}/inventory/v1`;
    case "desk": return `https://desk.zoho.${dc}/api/v1`;
    case "campaigns": return `https://campaigns.zoho.${dc}/api/v1.1`;
    case "projects": return `https://projectsapi.zoho.${dc}/restapi`;
    case "people": return `https://people.zoho.${dc}/people/api`;
    case "sign": return `https://sign.zoho.${dc}/api/v1`;
    case "recruit": return `https://recruit.zoho.${dc}/recruit/v2`;
    case "workdrive": return `https://workdrive.zoho.${dc}/api/v1`;
    case "analytics": return `https://analyticsapi.zoho.${dc}/restapi/v2`;
    case "cliq": return `https://cliq.zoho.${dc}/api/v2`;
    case "creator": return `https://www.zohoapis.${dc}/creator/v2.1`;
    case "bookings": return `https://www.zohoapis.${dc}/bookings/v1/json`;
  }
}
