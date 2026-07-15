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
} from "./cookie.js";
export { createSession, type Session, type SessionConfig } from "./session.js";
export {
  createServerSession, type ServerSession, type ServerSessionConfig, type SessionStore,
} from "./store-session.js";
export * from "./idle-timer.js";
export * from "./login-throttle.js";
export * from "./step-up.js";
export * from "./login-audit.js";
