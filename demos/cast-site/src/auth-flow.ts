/**
 * ソーシャルログイン(Google / Zoho)の認証フロー実装例。
 * UI(@platform/ui の LoginCard)からの遷移を受け、認可 URL 生成 → コールバックでコード交換 →
 * ユーザー情報取得 → セッション確立、までを基盤パッケージの組み合わせで示す。
 * ロジックは基盤側(@platform/google, @platform/zoho, @platform/session)にあり、ここは配線。
 * @packageDocumentation
 */
import { buildGoogleAuthUrl, exchangeGoogleCode, getGoogleUserInfo } from "@platform/google";
import {
  buildAuthorizationUrl as buildZohoAuthUrl,
  exchangeCodeForToken as exchangeZohoCode,
  getUserInfo as getZohoUserInfo,
  type ZohoDataCenter,
} from "@platform/zoho/core";
import { createServerSession, type SessionStore } from "@platform/session";

/** UI 側のプロバイダ種別。 */
export type LoginProvider = "google" | "zoho";

/** 認証に必要な各プロバイダの設定。 */
export interface AuthConfig {
  google: { clientId: string; clientSecret: string; redirectUri: string };
  zoho: { clientId: string; clientSecret: string; redirectUri: string; dataCenter: ZohoDataCenter };
}

/** 正規化したログインユーザー。 */
export interface SocialIdentity {
  provider: LoginProvider;
  externalId: string;
  email: string;
  displayName?: string;
  /** Google Workspace ドメイン(社内判定に使える)。 */
  workspaceDomain?: string;
}

/**
 * ① 認可 URL を生成する。LoginCard の hrefs か onSelectProvider から呼び、ここへリダイレクトする。
 * state は CSRF 対策として呼び出し側で生成・保存しておく。
 */
export function authorizeUrl(provider: LoginProvider, config: AuthConfig, state: string): string {
  if (provider === "google") {
    return buildGoogleAuthUrl({
      clientId: config.google.clientId,
      redirectUri: config.google.redirectUri,
      scopes: ["openid", "email", "profile"],
      state,
      forceConsent: true,
    });
  }
  return buildZohoAuthUrl({
    dataCenter: config.zoho.dataCenter,
    clientId: config.zoho.clientId,
    redirectUri: config.zoho.redirectUri,
    scope: ["openid", "email", "profile"],
    state,
  });
}

/**
 * ② コールバックでコードを交換し、ユーザー情報を取得して正規化する。
 * fetchImpl はテスト時に差し替え可能(基盤の関数がそのまま受け取る)。
 */
export async function completeLogin(
  provider: LoginProvider,
  code: string,
  config: AuthConfig,
  fetchImpl?: typeof fetch,
): Promise<SocialIdentity> {
  if (provider === "google") {
    const token = await exchangeGoogleCode({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      code,
      redirectUri: config.google.redirectUri,
      fetchImpl,
    });
    const info = await getGoogleUserInfo(token.accessToken, fetchImpl);
    return {
      provider,
      externalId: info.sub,
      email: info.email ?? "",
      displayName: info.name,
      workspaceDomain: info.hd,
    };
  }
  const token = await exchangeZohoCode({
    dataCenter: config.zoho.dataCenter,
    clientId: config.zoho.clientId,
    clientSecret: config.zoho.clientSecret,
    code,
    redirectUri: config.zoho.redirectUri,
    fetchImpl,
  });
  const result = await getZohoUserInfo({ dataCenter: config.zoho.dataCenter, accessToken: token.accessToken, fetchImpl });
  if (!result.ok) throw new Error(result.error);
  return {
    provider,
    externalId: result.value.zuid ?? result.value.email,
    email: result.value.email,
    displayName: result.value.displayName,
  };
}

/**
 * ③ 正規化したユーザーでサーバーセッションを確立し、Cookie ヘッダを返す。
 * 実際のユーザー作成/照合(getOrCreateUser)はアプリの DB 層で行う。
 */
export async function establishSession(
  identity: SocialIdentity,
  store: SessionStore,
  getOrCreateUser: (identity: SocialIdentity) => Promise<{ id: string; role: string }>,
): Promise<{ userId: string; setCookie: string }> {
  const user = await getOrCreateUser(identity);
  const session = createServerSession<{ role: string; email: string }>({ store, cookieName: "sid" });
  const created = await session.create(user.id, { role: user.role, email: identity.email });
  return { userId: user.id, setCookie: created.setCookie };
}
