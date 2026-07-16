/**
 * `@platform/auth` — 認証・認可の共通部品。
 *
 * - RBAC(ロール/権限/`can`/`assertCan`)… フレームワーク非依存の純ロジック。
 * - セッション/ユーザーの共通型。
 * - OIDC プロバイダ設定の標準化。
 *
 * 実際の SSO フロー(リダイレクト等)はアプリ側の Auth.js 等が担う。
 * @packageDocumentation
 */
export {
  definePolicy,
  can,
  permissionsOf,
  type Permission,
  type Role,
  type Policy,
} from "./rbac";
export { assertCan, type AuthUser, type Session } from "./session";
export {
  resolveIssuer,
  type OidcProviderConfig,
  type OidcProviderKind,
} from "./oidc";
export {
  resolveHierarchy, canAny, canAll, canScoped, filterAuthorized, featureFlags,
  type RoleDefinition, type RoleHierarchy,
} from "./hierarchy";
export * from "./otp";
export * from "./totp";
export * from "./recovery-codes";
export * from "./two-factor";
export * from "./webauthn";
