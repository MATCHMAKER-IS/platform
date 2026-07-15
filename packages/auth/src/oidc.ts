/**
 * OIDC プロバイダ設定の抽象。
 * 実際の認証フロー(リダイレクト・コールバック・セッション発行)は
 * アプリ側の Auth.js 等が担う。ここでは主要 IdP の設定を型で標準化し、
 * アプリ間で設定形式がばらつかないようにする。
 *
 * @packageDocumentation
 */

/** サポートする IdP 種別。 */
export type OidcProviderKind = "entra" | "google" | "generic";

/** OIDC プロバイダ設定。 */
export interface OidcProviderConfig {
  kind: OidcProviderKind;
  clientId: string;
  clientSecret: string;
  /** generic の場合の発行者 URL(Entra/Google は kind から既知)。 */
  issuer?: string;
  /** Entra(Azure AD)のテナント ID。 */
  tenantId?: string;
}

/**
 * IdP 種別から issuer(発行者 URL)を解決する。
 * @param config プロバイダ設定
 * @returns issuer URL
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 未対応の IdP 種別、または custom で issuer 未指定の場合
 */
export function resolveIssuer(config: OidcProviderConfig): string {
  switch (config.kind) {
    case "google":
      return "https://accounts.google.com";
    case "entra":
      return `https://login.microsoftonline.com/${config.tenantId ?? "common"}/v2.0`;
    case "generic":
      if (!config.issuer) throw new Error("generic プロバイダには issuer が必要です");
      return config.issuer;
  }
}
