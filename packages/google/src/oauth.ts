/**
 * Google OAuth2 ログイン + トークン管理。
 * 認可 URL 生成 → コード交換 → トークン自動更新(リフレッシュ)→ ユーザー情報取得までを担う。
 * SSO ログインや、各 Google API(Sheets/Calendar/Gmail/Drive)の認証に使う。
 * @packageDocumentation
 */

/** 認可 URL のパラメータ。 */
export interface GoogleAuthUrlParams {
  clientId: string;
  redirectUri: string;
  /** 要求スコープ(例 ["openid","email","https://www.googleapis.com/auth/calendar"])。 */
  scopes: string[];
  /** CSRF 対策の state。 */
  state?: string;
  /** refresh_token を得るため offline を指定(既定 true)。 */
  offline?: boolean;
  /** 毎回同意を求める(refresh_token を確実に得る)。既定 false。 */
  forceConsent?: boolean;
  /** ログインヒント(メールアドレス)。 */
  loginHint?: string;
}

/** Google のログイン画面 URL を組み立てる。 */
export function buildGoogleAuthUrl(params: GoogleAuthUrlParams): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scopes.join(" "),
    access_type: params.offline === false ? "online" : "offline",
    include_granted_scopes: "true",
  });
  if (params.state) q.set("state", params.state);
  if (params.forceConsent) q.set("prompt", "consent");
  if (params.loginHint) q.set("login_hint", params.loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

/** トークン交換・更新の結果。 */
export interface GoogleTokenResult {
  accessToken: string;
  /** 初回のみ返る(refresh_token)。 */
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  idToken?: string;
}

/** 認可コードをトークンに交換する(ログインのコールバックで呼ぶ)。 */
export async function exchangeGoogleCode(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): Promise<GoogleTokenResult> {
  const doFetch = params.fetchImpl ?? fetch;
  const now = params.now ?? (() => Date.now());
  const res = await doFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Google トークン交換に失敗しました: ${res.status}`);
  const json = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number; scope?: string; id_token?: string };
  return {
    accessToken: json.access_token,
    ...(json.refresh_token ? { refreshToken: json.refresh_token } : {}),
    expiresAt: now() + json.expires_in * 1000,
    ...(json.scope ? { scope: json.scope } : {}),
    ...(json.id_token ? { idToken: json.id_token } : {}),
  };
}

/** {@link createGoogleTokenManager} の設定。 */
export interface GoogleTokenConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  initialAccessToken?: string;
  initialExpiresAt?: number;
  expiryBufferMs?: number;
  onRefresh?: (result: GoogleTokenResult) => void | Promise<void>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** Google トークンマネージャ。 */
export interface GoogleTokenManager {
  getAccessToken(): Promise<string>;
  invalidate(): void;
}

/** リフレッシュトークンで自動更新するトークンマネージャを作る。 */
export function createGoogleTokenManager(config: GoogleTokenConfig): GoogleTokenManager {
  const buffer = config.expiryBufferMs ?? 5 * 60 * 1000;
  const now = config.now ?? (() => Date.now());
  let accessToken = config.initialAccessToken;
  let expiresAt = config.initialExpiresAt ?? 0;
  let inflight: Promise<string> | null = null;

  async function doRefresh(): Promise<string> {
    const doFetch = config.fetchImpl ?? fetch;
    const res = await doFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }).toString(),
    });
    if (!res.ok) throw new Error(`Google トークン更新に失敗しました: ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number; scope?: string };
    accessToken = json.access_token;
    expiresAt = now() + json.expires_in * 1000;
    // Google のリフレッシュ応答に refresh_token は含まれない(既存を使い続ける)
    await config.onRefresh?.({ accessToken: json.access_token, expiresAt, ...(json.scope ? { scope: json.scope } : {}) });
    return json.access_token;
  }

  return {
    async getAccessToken() {
      if (accessToken && now() < expiresAt - buffer) return accessToken;
      if (!inflight) inflight = doRefresh().finally(() => { inflight = null; });
      return inflight;
    },
    invalidate() { expiresAt = 0; },
  };
}

/** トークンマネージャを使う認証付き fetch(401 で1度だけ再更新して再試行)。 */
export function createGoogleAuthedFetch(manager: GoogleTokenManager, baseFetch?: typeof fetch): typeof fetch {
  const doFetch = baseFetch ?? fetch;
  return (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const token = await manager.getAccessToken();
    const withAuth = (t: string): RequestInit => ({ ...init, headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Bearer ${t}` } });
    let res = await doFetch(input, withAuth(token));
    if (res.status === 401) {
      manager.invalidate();
      res = await doFetch(input, withAuth(await manager.getAccessToken()));
    }
    return res;
  }) as typeof fetch;
}

/** ログインユーザーの基本情報(OpenID Connect userinfo)。 */
export interface GoogleUserInfo {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  picture?: string;
  hd?: string; // Google Workspace のドメイン(社内判定に使える)
}

/** アクセストークンからユーザー情報を取得する(SSO ログイン後のプロフィール確定)。 */
export async function getGoogleUserInfo(accessToken: string, fetchImpl?: typeof fetch): Promise<GoogleUserInfo> {
  const doFetch = fetchImpl ?? fetch;
  const res = await doFetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google ユーザー情報の取得に失敗しました: ${res.status}`);
  const j = (await res.json()) as { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string; hd?: string };
  return {
    sub: j.sub,
    ...(j.email ? { email: j.email } : {}),
    ...(j.email_verified !== undefined ? { emailVerified: j.email_verified } : {}),
    ...(j.name ? { name: j.name } : {}),
    ...(j.picture ? { picture: j.picture } : {}),
    ...(j.hd ? { hd: j.hd } : {}),
  };
}
