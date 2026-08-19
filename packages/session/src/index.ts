/**
 * `@platform/session` — セッション・クッキー処理の共通部品。
 *
 * - クッキー: {@link parseCookies} / {@link serializeCookie} / {@link clearCookie}
 * - ステートレス封緘クッキーセッション: {@link createSession}(AES-256-GCM 封緘)
 * - ストア型セッション: {@link createServerSession}(失効可能・大きめデータ向き)
 *
 * @packageDocumentation
 */
export {
  parseCookies, getCookie, serializeCookie, clearCookie, type CookieOptions,
} from "./cookie";
export { createSession, MAX_COOKIE_AGE_SEC, type Session, type SessionConfig, type SessionInfo } from "./session";
export { createOAuthChallenge, verifyOAuthState, type OAuthChallenge } from "./oauth-challenge";
export { createAuthSession, isExternalLogin, type AuthProvider, type AuthSessionOptions, type AuthSessionPayload } from "./auth-session";
export {
  createServerSession, type ServerSession, type ServerSessionConfig, type SessionStore,
} from "./store-session";
export * from "./idle-timer";
export * from "./login-throttle";
export * from "./step-up";
export * from "./login-audit";
export * from "./revocation";
