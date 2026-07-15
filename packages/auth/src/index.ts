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
} from "./rbac.js";
export { assertCan, type AuthUser, type Session } from "./session.js";
export {
  resolveIssuer,
  type OidcProviderConfig,
  type OidcProviderKind,
} from "./oidc.js";
export {
  resolveHierarchy, canAny, canAll, canScoped, filterAuthorized, featureFlags,
  type RoleDefinition, type RoleHierarchy,
} from "./hierarchy.js";
export * from "./otp.js";
export * from "./totp.js";
export * from "./recovery-codes.js";
export * from "./two-factor.js";
export * from "./webauthn.js";
