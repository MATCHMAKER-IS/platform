/**
 * Zoho OAuth 認可コードフロー(ログイン)と、ユーザー情報取得。
 * 社内アプリの「Zoho でログイン」に使う。
 * @packageDocumentation
 */
import { accountsUrl, type ZohoDataCenter } from "./datacenter";

/** 認可 URL 生成の入力。 */
export interface AuthorizationUrlInput {
  dataCenter: ZohoDataCenter;
  clientId: string;
  redirectUri: string;
  /** スコープ(例: ["AaaServer.profile.READ","email"] や ["openid","email","profile"])。 */
  scope: string[];
  /** CSRF 対策の state。 */
  state?: string;
  /** offline でリフレッシュトークンを得る(既定 offline)。 */
  accessType?: "offline" | "online";
  /** consent を毎回求めるか。 */
  prompt?: "consent";
}

/**
 * 認可 URL を生成する(ここへリダイレクトしてログインさせる)。
 *
 * **`state` は必ず検証すること**(CSRF 対策)。生成時にセッションへ保存し、
 * 戻ってきたときに一致を確認する。
 *
 * @param config.clientId クライアント ID
 * @param config.redirectUri 戻り先の URL(**Zoho 側の設定と完全一致**であること)
 * @param config.scope 要求する権限
 * @param config.dc データセンター
 * @param config.state CSRF 対策のトークン
 * @returns 認可 URL
 */
export function buildAuthorizationUrl(input: AuthorizationUrlInput): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    scope: input.scope.join(","),
    access_type: input.accessType ?? "offline",
  });
  if (input.state) params.set("state", input.state);
  if (input.prompt) params.set("prompt", input.prompt);
  return `${accountsUrl(input.dataCenter)}/oauth/v2/auth?${params.toString()}`;
}

/** トークン交換の結果。 */
export interface CodeExchangeResult { accessToken: string; refreshToken?: string; apiDomain: string; expiresIn: number }

/**
 * 認可コードをトークンに交換する。
 *
 * **リフレッシュトークンは初回しか返らない**(Zoho の仕様)。
 * 取りこぼすと、利用者にもう一度認可させることになる。**必ず保存すること**。
 *
 * @param code 認可コード
 * @param config クライアント ID・シークレット・redirect_uri・DC
 * @param fetchImpl fetch の実装(テスト注入用)
 * @returns アクセストークン・リフレッシュトークン・api_domain
 */
export async function exchangeCodeForToken(config: {
  dataCenter: ZohoDataCenter;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; value: CodeExchangeResult } | { ok: false; error: string }> {
  const doFetch = config.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    code: config.code,
  });
  try {
    const res = await doFetch(`${accountsUrl(config.dataCenter)}/oauth/v2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) return { ok: false, error: `トークン交換に失敗しました: ${res.status}` };
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; api_domain?: string; expires_in?: number; error?: string };
    if (j.error || !j.access_token) return { ok: false, error: j.error ?? "access_token が返りませんでした" };
    return { ok: true, value: { accessToken: j.access_token, refreshToken: j.refresh_token, apiDomain: j.api_domain ?? `https://www.zohoapis.${config.dataCenter}`, expiresIn: j.expires_in ?? 3600 } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}


/**
 * リフレッシュトークンでアクセストークンを取り直す。ヘッドレス実行(MCP サーバ・バッチ・cron)用。
 * Self Client 等で発行した refresh_token を環境変数に置き、起動時に呼ぶ。
 *
 * **人の操作を伴わない**のが {@link exchangeCodeForToken} との違い(あちらはブラウザで認可する)。
 *
 * @param config.refreshToken リフレッシュトークン(**環境変数から。コードに直書きしない**)
 * @param config.clientId クライアント ID
 * @param config.clientSecret クライアントシークレット
 * @param config.dc データセンター
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns アクセストークンと有効期限
 */
export async function refreshAccessToken(config: {
  dataCenter: ZohoDataCenter;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; value: { accessToken: string; apiDomain: string; expiresIn: number } } | { ok: false; error: string }> {
  const doFetch = config.fetchImpl ?? fetch;
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
  });
  try {
    const res = await doFetch(`${accountsUrl(config.dataCenter)}/oauth/v2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!res.ok) return { ok: false, error: `トークン更新に失敗しました: ${res.status}` };
    const j = (await res.json()) as { access_token?: string; api_domain?: string; expires_in?: number; error?: string };
    if (j.error || !j.access_token) return { ok: false, error: j.error ?? "access_token が返りませんでした" };
    return { ok: true, value: { accessToken: j.access_token, apiDomain: j.api_domain ?? `https://www.zohoapis.${config.dataCenter}`, expiresIn: j.expires_in ?? 3600 } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Zoho ユーザープロフィール。 */
export interface ZohoUserInfo { zuid?: string; email: string; displayName?: string; firstName?: string; lastName?: string }

/**
 * アクセストークンでユーザー情報を取得する(ログイン後の本人特定)。
 *
 * @param accessToken アクセストークン
 * @param dc データセンター
 * @param fetchImpl fetch の実装(テスト注入用)
 * @returns メールアドレス・氏名など
 */
export async function getUserInfo(config: { dataCenter: ZohoDataCenter; accessToken: string; fetchImpl?: typeof fetch }): Promise<{ ok: true; value: ZohoUserInfo } | { ok: false; error: string }> {
  const doFetch = config.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${accountsUrl(config.dataCenter)}/oauth/user/info`, {
      headers: { Authorization: `Zoho-oauthtoken ${config.accessToken}` },
    });
    if (!res.ok) return { ok: false, error: `ユーザー情報取得に失敗しました: ${res.status}` };
    const j = (await res.json()) as Record<string, string>;
    const email = j.Email ?? j.email ?? "";
    if (!email) return { ok: false, error: "メールアドレスが取得できませんでした" };
    return { ok: true, value: { zuid: j.ZUID ?? j.zuid, email, displayName: j.Display_Name ?? j.display_name, firstName: j.First_Name ?? j.first_name, lastName: j.Last_Name ?? j.last_name } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
