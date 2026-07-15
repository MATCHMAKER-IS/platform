/**
 * freee OAuth2 トークン管理。freee のアクセストークンは約6時間で失効するため、
 * リフレッシュトークンで自動更新する。401 時の自動リトライつき authed fetch も提供する。
 * トークンの永続化(DB 保存等)は onRefresh コールバックでアプリ側に委ねる。
 * @packageDocumentation
 */

/** トークンレスポンス(freee /oauth/token)。 */
export interface FreeeTokenResult {
  accessToken: string;
  refreshToken: string;
  /** 有効期限(epoch ms)。 */
  expiresAt: number;
}

/** {@link createFreeeTokenManager} の設定。 */
export interface FreeeTokenConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** 初期アクセストークン(あれば。無ければ初回に更新)。 */
  initialAccessToken?: string;
  /** 初期の有効期限(epoch ms)。 */
  initialExpiresAt?: number;
  /** 失効前のバッファ(既定 5分)。この時間内なら先に更新する。 */
  expiryBufferMs?: number;
  /** 更新時のコールバック(新トークンを DB 保存する等)。 */
  onRefresh?: (result: FreeeTokenResult) => void | Promise<void>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** freee トークンマネージャ。 */
export interface FreeeTokenManager {
  /** 有効なアクセストークンを返す(必要なら自動更新)。 */
  getAccessToken(): Promise<string>;
  /** トークンを無効化して次回強制更新させる(401 検知時など)。 */
  invalidate(): void;
}

/** freee のトークンエンドポイントで更新する。 */
async function refreshFreeeToken(config: FreeeTokenConfig): Promise<FreeeTokenResult> {
  const doFetch = config.fetchImpl ?? fetch;
  const now = config.now ?? (() => Date.now());
  const res = await doFetch("https://accounts.secure.freee.co.jp/public_api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
    }).toString(),
  });
  if (!res.ok) throw new Error(`freee トークン更新に失敗しました: ${res.status}`);
  const json = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: now() + json.expires_in * 1000,
  };
}

/** freee トークンマネージャを作る。 */
export function createFreeeTokenManager(config: FreeeTokenConfig): FreeeTokenManager {
  const buffer = config.expiryBufferMs ?? 5 * 60 * 1000;
  const now = config.now ?? (() => Date.now());
  let accessToken = config.initialAccessToken;
  let refreshToken = config.refreshToken;
  let expiresAt = config.initialExpiresAt ?? 0;
  let inflight: Promise<string> | null = null;

  async function doRefresh(): Promise<string> {
    const result = await refreshFreeeToken({ ...config, refreshToken });
    accessToken = result.accessToken;
    refreshToken = result.refreshToken; // freee はリフレッシュトークンもローテーションする
    expiresAt = result.expiresAt;
    await config.onRefresh?.(result); // 新トークンを永続化(次回起動でも使えるように)
    return result.accessToken;
  }

  return {
    async getAccessToken() {
      // 有効期限内ならそのまま
      if (accessToken && now() < expiresAt - buffer) return accessToken;
      // 同時多発の更新を1本化
      if (!inflight) inflight = doRefresh().finally(() => { inflight = null; });
      return inflight;
    },
    invalidate() { expiresAt = 0; },
  };
}

/** トークンマネージャを使う認証付き fetch を作る(401 で1度だけ再更新して再試行)。 */
export function createFreeeAuthedFetch(manager: FreeeTokenManager, baseFetch?: typeof fetch): typeof fetch {
  const doFetch = baseFetch ?? fetch;
  const authed = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const token = await manager.getAccessToken();
    const withAuth = (t: string): RequestInit => ({ ...init, headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Bearer ${t}` } });
    let res = await doFetch(input, withAuth(token));
    if (res.status === 401) {
      manager.invalidate();
      const token2 = await manager.getAccessToken();
      res = await doFetch(input, withAuth(token2));
    }
    return res;
  }) as typeof fetch;
  return authed;
}
