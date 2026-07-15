/**
 * Zoho ログイン サービス。認可 URL 生成とコールバック処理(コード交換 → 本人情報 → セッション発行)。
 * @packageDocumentation
 */
import { buildAuthorizationUrl, exchangeCodeForToken, getUserInfo, type ZohoDataCenter } from "@platform/zoho/core";
import { signSession, type SessionPayload } from "./zoho-session.js";
import { resolveRoles } from "./roles.js";

/** ログイン設定(通常は環境変数から)。 */
export interface ZohoAuthConfig {
  dataCenter: ZohoDataCenter;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  sessionSecret: string;
  /** セッション有効期間(秒。既定 8 時間)。 */
  sessionTtlSec?: number;
  /** 許可するメールドメイン(社内限定。空なら制限なし)。 */
  allowedEmailDomains?: string[];
}

/** 環境変数から設定を読む。 */
export function zohoAuthConfigFromEnv(env: Record<string, string | undefined> = process.env): ZohoAuthConfig {
  return {
    dataCenter: (env.ZOHO_DC ?? "jp") as ZohoDataCenter,
    clientId: env.ZOHO_CLIENT_ID ?? "",
    clientSecret: env.ZOHO_CLIENT_SECRET ?? "",
    redirectUri: env.ZOHO_REDIRECT_URI ?? "",
    scope: (env.ZOHO_SCOPE ?? "AaaServer.profile.READ,email").split(","),
    sessionSecret: env.SESSION_SECRET ?? "",
    sessionTtlSec: env.SESSION_TTL_SEC ? Number(env.SESSION_TTL_SEC) : 8 * 3600,
    allowedEmailDomains: env.ALLOWED_EMAIL_DOMAINS ? env.ALLOWED_EMAIL_DOMAINS.split(",") : undefined,
  };
}

/** ログイン開始 URL を作る。 */
export function getLoginUrl(config: ZohoAuthConfig, state: string): string {
  return buildAuthorizationUrl({ dataCenter: config.dataCenter, clientId: config.clientId, redirectUri: config.redirectUri, scope: config.scope, state, accessType: "offline" });
}

/** コールバック処理結果。 */
export type CallbackResult =
  | { ok: true; sessionToken: string; user: SessionPayload }
  | { ok: false; error: string };

/** 認可コードを処理し、本人情報を取得してセッショントークンを発行する。 */
export async function handleZohoCallback(config: ZohoAuthConfig, code: string, fetchImpl?: typeof fetch): Promise<CallbackResult> {
  const token = await exchangeCodeForToken({ dataCenter: config.dataCenter, clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri, code, fetchImpl });
  if (!token.ok) return { ok: false, error: token.error };
  const info = await getUserInfo({ dataCenter: config.dataCenter, accessToken: token.value.accessToken, fetchImpl });
  if (!info.ok) return { ok: false, error: info.error };

  const domain = info.value.email.split("@")[1] ?? "";
  if (config.allowedEmailDomains && config.allowedEmailDomains.length > 0 && !config.allowedEmailDomains.includes(domain)) {
    return { ok: false, error: `許可されていないドメインです: ${domain}` };
  }

  const payload: SessionPayload = {
    email: info.value.email,
    name: info.value.displayName,
    zuid: info.value.zuid,
    roles: resolveRoles(info.value.email),
    exp: Math.floor(Date.now() / 1000) + (config.sessionTtlSec ?? 8 * 3600),
  };
  return { ok: true, sessionToken: signSession(payload, config.sessionSecret), user: payload };
}
