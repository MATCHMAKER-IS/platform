/**
 * Microsoft Entra ID(旧 Azure AD)の OAuth 2.0。
 *
 * 社内で Microsoft 365 を使っているなら、**認証を Entra ID に任せられる**。
 * その場合、2 要素認証やパスワード再設定は Entra 側の手続きになる(ADR 0016)。
 *
 * Google と作りを揃えてある(`createGoogleTokenManager` と同じ考え方)。
 * 違うのは **テナント** の概念があること:
 *   - `common`       … 個人・組織どちらのアカウントも受け入れる
 *   - `organizations`… 組織アカウントのみ
 *   - `<テナントID>`  … **自社のアカウントだけ**(社内システムはこれにする)
 *
 * 社内システムで `common` にすると、**他社のアカウントでもログインできてしまう**。
 * 既定を自社テナントに寄せる意味で、tenantId は必須にしている。
 * @packageDocumentation
 */

/** 認可画面の URL を組み立てる引数。 */
export interface MicrosoftAuthUrlParams {
  /** アプリ(クライアント)ID。 */
  clientId: string;
  /** 戻り先 URL(Entra 側の登録と完全一致させる)。 */
  redirectUri: string;
  /** テナント ID。`common` にすると他社アカウントも通るため、社内用途では自社の ID を指定する。 */
  tenantId: string;
  /** 要求する権限(例: `["User.Read", "Mail.Send"]`)。 */
  scope: string[];
  /** CSRF 対策の状態文字列。呼び出し側で検証する。 */
  state: string;
  /** リフレッシュトークンを得るために既定で付ける(offline_access)。 */
  offlineAccess?: boolean;
}

/**
 * 認可画面の URL を作る。
 *
 * @param params テナント・クライアント・スコープなど
 * @returns 利用者をリダイレクトさせる URL
 *
 * @example
 * ```ts
 * const url = buildMicrosoftAuthUrl({
 *   clientId, redirectUri, tenantId, scope: ["User.Read"], state,
 * });
 * ```
 */
export function buildMicrosoftAuthUrl(params: MicrosoftAuthUrlParams): string {
  const scope = [...params.scope];
  if (params.offlineAccess !== false && !scope.includes("offline_access")) scope.push("offline_access");
  const q = new URLSearchParams({
    client_id: params.clientId,
    response_type: "code",
    redirect_uri: params.redirectUri,
    response_mode: "query",
    scope: scope.join(" "),
    state: params.state,
  });
  return `https://login.microsoftonline.com/${encodeURIComponent(params.tenantId)}/oauth2/v2.0/authorize?${q.toString()}`;
}

/** トークン取得・更新の結果。 */
export interface MicrosoftTokenResult {
  accessToken: string;
  /** 再発行される場合がある(返らないこともある)。 */
  refreshToken?: string;
  /** 失効時刻(ミリ秒)。 */
  expiresAt: number;
  scope?: string;
}

/** トークンマネージャの設定。 */
export interface MicrosoftTokenConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  refreshToken: string;
  initialAccessToken?: string;
  initialExpiresAt?: number;
  /** 失効の何ミリ秒前から更新するか(既定 5 分)。 */
  expiryBufferMs?: number;
  /** 更新時に呼ばれる。**新しいリフレッシュトークンを保存する**ために使う。 */
  onRefresh?: (result: MicrosoftTokenResult) => void | Promise<void>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** トークンマネージャ。 */
export interface MicrosoftTokenManager {
  /** 有効なアクセストークンを返す(必要なら更新する)。 */
  getAccessToken(): Promise<string>;
  /** 保持しているトークンを捨てる(401 を受けたときなど)。 */
  invalidate(): void;
}

/**
 * アクセストークンの取得と更新をまとめる。
 *
 * 同時に複数の呼び出しが来ても、**更新は 1 回だけ**にする
 * (同時更新すると、片方のリフレッシュトークンが無効化されることがある)。
 *
 * @param config クライアント情報とリフレッシュトークン
 * @returns トークンマネージャ
 * @throws Error トークンの更新に失敗したとき(リフレッシュトークンの失効など)
 */
export function createMicrosoftTokenManager(config: MicrosoftTokenConfig): MicrosoftTokenManager {
  const buffer = config.expiryBufferMs ?? 5 * 60 * 1000;
  const now = config.now ?? (() => Date.now());
  let accessToken = config.initialAccessToken;
  let expiresAt = config.initialExpiresAt ?? 0;
  let refreshToken = config.refreshToken;
  let inflight: Promise<string> | null = null;

  async function doRefresh(): Promise<string> {
    const doFetch = config.fetchImpl ?? fetch;
    const res = await doFetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }).toString(),
    });
    if (!res.ok) throw new Error(`Microsoft トークン更新に失敗しました: ${res.status}`);
    const json = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string; scope?: string };

    accessToken = json.access_token;
    expiresAt = now() + json.expires_in * 1000;
    // Entra はリフレッシュトークンを回転させることがある。返ってきたら差し替えて保存する
    if (json.refresh_token) refreshToken = json.refresh_token;
    await config.onRefresh?.({ accessToken, refreshToken: json.refresh_token, expiresAt, scope: json.scope });
    return accessToken;
  }

  return {
    async getAccessToken() {
      if (accessToken && now() < expiresAt - buffer) return accessToken;
      if (!inflight) {
        inflight = doRefresh().finally(() => { inflight = null; });
      }
      return inflight;
    },
    invalidate() {
      accessToken = undefined;
      expiresAt = 0;
    },
  };
}

/**
 * トークンを自動で付ける fetch を作る。
 *
 * 401 が返ったら 1 度だけトークンを捨てて再試行する
 * (期限内でも失効していることがあるため)。
 *
 * @param manager   トークンマネージャ
 * @param baseFetch 実際の fetch(テスト用に差し替え可能)
 * @returns 認証済みの fetch
 */
export function createMicrosoftAuthedFetch(manager: MicrosoftTokenManager, baseFetch?: typeof fetch): typeof fetch {
  const doFetch = baseFetch ?? fetch;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const send = async () => {
      const token = await manager.getAccessToken();
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return doFetch(input, { ...init, headers });
    };
    const res = await send();
    if (res.status !== 401) return res;
    manager.invalidate();
    return send();
  }) as typeof fetch;
}
