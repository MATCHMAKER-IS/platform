/**
 * Zoho アクセストークンの自動更新マネージャと、それを使う fetch ラッパー。
 * @packageDocumentation
 */
import { refreshAccessToken } from "./oauth";
import type { ZohoDataCenter } from "./datacenter";

/** トークンマネージャ設定。 */
export interface TokenManagerConfig {
  dataCenter: ZohoDataCenter;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** 既知のアクセストークン(あれば初回更新を省ける)。 */
  initialAccessToken?: string;
  /** 既知トークンの有効期限(epoch ms)。 */
  initialExpiresAt?: number;
  /** 期限バッファ(この時間前に更新。既定 5 分)。 */
  expiryBufferMs?: number;
  fetchImpl?: typeof fetch;
}

/** トークンマネージャ。 */
export interface ZohoTokenManager {
  /** 有効なアクセストークンを返す(必要なら更新)。失敗時は throw。 */
  getAccessToken(): Promise<string>;
  /** 現在の api_domain(更新済みなら反映)。 */
  getApiDomain(): string | undefined;
  /** キャッシュを破棄して次回強制更新。 */
  invalidate(): void;
}

/**
 * トークンを自動更新するマネージャを作る。
 *
 * **同時に複数のリクエストが更新を始めないよう単一化する**。
 * これが無いと、10 並列のリクエストが 10 回更新を投げ、レート制限に当たる
 * (さらに、古いトークンで上書きし合って壊れることもある)。
 *
 * @param options.refreshToken リフレッシュトークン
 * @param options.config クライアント ID・シークレット・DC
 * @param options.onRefresh 更新時の通知(保存に使う)
 * @returns マネージャ。`getAccessToken` で有効なトークンを得る
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — トークンの更新に失敗した場合(`getAccessToken` 実行時)
 */
export function createZohoTokenManager(config: TokenManagerConfig): ZohoTokenManager {
  const buffer = config.expiryBufferMs ?? 5 * 60 * 1000;
  let accessToken = config.initialAccessToken;
  let expiresAt = config.initialExpiresAt ?? 0;
  let apiDomain: string | undefined;
  let inflight: Promise<string> | null = null;

  async function doRefresh(): Promise<string> {
    const res = await refreshAccessToken({
      dataCenter: config.dataCenter,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      fetchImpl: config.fetchImpl,
    });
    if (!res.ok) throw new Error(res.error);
    accessToken = res.value.accessToken;
    apiDomain = res.value.apiDomain;
    expiresAt = Date.now() + res.value.expiresIn * 1000;
    return accessToken;
  }

  return {
    async getAccessToken() {
      if (accessToken && Date.now() < expiresAt - buffer) return accessToken;
      if (!inflight) inflight = doRefresh().finally(() => { inflight = null; });
      return inflight;
    },
    getApiDomain() { return apiDomain; },
    invalidate() { accessToken = undefined; expiresAt = 0; },
  };
}

/**
 * トークンマネージャを使い、`Authorization: Zoho-oauthtoken` を自動付与する fetch を返す。
 * 各サービスクライアントの `fetchImpl` に渡せば、トークン更新が透過的になる。
 * 401 の場合は 1 度だけ強制更新して再試行する。
 *
 * @param manager トークンマネージャ
 * @param fetchImpl fetch の実装(テスト注入用)
 * @returns 認証ヘッダを自動で付ける fetch。**トークンの更新も自動**(呼び出し側は意識しなくてよい)
 */
export function createAuthedFetch(manager: ZohoTokenManager, baseFetch?: typeof fetch): typeof fetch {
  const doFetch = baseFetch ?? fetch;
  const authed = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const token = await manager.getAccessToken();
    const withAuth = (t: string): RequestInit => ({ ...init, headers: { ...(init?.headers as Record<string, string> | undefined), Authorization: `Zoho-oauthtoken ${t}` } });
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
