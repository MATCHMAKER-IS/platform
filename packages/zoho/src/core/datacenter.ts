/**
 * Zoho データセンター(DC)ごとのドメイン解決。
 * @packageDocumentation
 */

/** Zoho の各データセンター TLD。 */
export type ZohoDataCenter = "com" | "eu" | "in" | "com.au" | "jp" | "ca" | "com.cn" | "sa";

/** DC 一覧。 */
export const ZOHO_DATA_CENTERS: readonly ZohoDataCenter[] = ["com", "eu", "in", "com.au", "jp", "ca", "com.cn", "sa"];

/**
 * OAuth 用の Zoho Accounts URL を返す。
 *
 * **Zoho はデータセンター(DC)ごとに URL が違う**(日本は `.jp`、米国は `.com`)。
 * 間違えると認証できない。契約時の DC を確認すること。
 *
 * @param dc データセンター(`com` / `jp` / `eu` など)
 * @returns Accounts の URL
 */
export function accountsUrl(dc: ZohoDataCenter): string {
  return `https://accounts.zoho.${dc}`;
}

/**
 * API 呼び出し用のドメインを返す。
 *
 * **トークン応答の `api_domain` があればそちらを優先**する
 * (Zoho 側が正しい DC を教えてくれるため、こちらの推測より確実)。
 *
 * @param dc データセンター
 * @param apiDomain トークン応答の api_domain(任意)
 * @returns API のドメイン
 */
export function apiDomain(dc: ZohoDataCenter): string {
  return `https://www.zohoapis.${dc}`;
}

/**
 * `api_domain` から DC を推定する。
 *
 * @param apiDomain トークン応答の api_domain
 * @returns 推定した DC。**不明なら `com`**(最も一般的なため)
 */
export function detectDataCenter(apiDomainOrUrl: string): ZohoDataCenter {
  const m = apiDomainOrUrl.match(/zohoapis\.([a-z.]+)/);
  const tld = m?.[1];
  return (ZOHO_DATA_CENTERS as readonly string[]).includes(tld ?? "") ? (tld as ZohoDataCenter) : "com";
}

/** Zoho の対象サービス。 */
export type ZohoService = "crm" | "books" | "desk" | "inventory" | "campaigns" | "projects" | "people" | "sign" | "recruit" | "workdrive" | "analytics" | "cliq" | "creator" | "bookings";

/**
 * サービスと DC からベース URL を解決する。
 *
 * **サービスごとにドメインもパスも違う**(CRM は `/crm/v5`、Books は `/books/v3`)。
 * ここで一元管理することで、呼び出し側は URL を組み立てなくてよい。
 *
 * @param service サービス(`crm` / `books` / `desk` など)
 * @param dc データセンター
 * @param apiDomain トークン応答の api_domain(任意・優先される)
 * @returns ベース URL
 */
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
