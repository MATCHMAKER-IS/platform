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
  /**
   * PKCE のチャレンジ(`createOAuthChallenge` が作る `codeChallenge`)。
   *
   * **必ず渡すこと。** 無くても認可は通るが、**認可コードを盗まれると
   * そのままトークンに交換される**——リダイレクト URL はプロキシ・CDN・
   * ブラウザ履歴に残り、`Referer` で外部へ漏れることもある。
   */
  codeChallenge?: string;
  /** PKCE の方式(`"S256"`)。`codeChallenge` を渡すなら必須。 */
  codeChallengeMethod?: "S256";
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
  // **PKCE。** 渡されたときだけ載せる(既存の呼び出しを壊さない)。
  // **`codeVerifier` は載せない**——載せたら意味が無い(2026-08)
  if (params.codeChallenge !== undefined && params.codeChallenge !== "") {
    q.set("code_challenge", params.codeChallenge);
    q.set("code_challenge_method", params.codeChallengeMethod ?? "S256");
  }
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
/**
 * Microsoft Graph の応答を待つ上限(ミリ秒)。
 *
 * **10 秒**は `@platform/integrations` の共通クライアントと同じ既定。
 * Graph は普段 1 秒以内に返るので、10 秒待って返らなければ**異常**。
 */
const GRAPH_TIMEOUT_MS = 10_000;

/**
 * **認証済みの `fetch`** を作る（Microsoft Graph 用）。
 *
 * トークンの取得と付け替えを引き受けるので、**呼ぶ側は認証を意識しません**。
 *
 * **10 秒で切れます。** 相手が応答しないとき**永久に待たない**ためです
 * ——Next.js のサーバ側で待ち続けると、**そのリクエストが返らず利用者は白い画面**
 * のままになります。呼び出し側が `signal` を渡していればそちらを優先します。
 *
 * @param manager トークンを管理する器
 * @param baseFetch 差し替え用（省略時は組み込みの `fetch`）
 * @returns 認証済みの `fetch`
 */
export function createMicrosoftAuthedFetch(manager: MicrosoftTokenManager, baseFetch?: typeof fetch): typeof fetch {
  const doFetch = baseFetch ?? fetch;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const send = async () => {
      const token = await manager.getAccessToken();
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      // **タイムアウトを付ける。** 2026-08 まで無く、
      // **相手が応答しないと永久に待って**いた——Next.js のサーバ側なら
      // そのリクエストが返らず、**利用者は白い画面のまま**になる。
      // 呼び出し側が `signal` を渡していればそちらを優先する
      const signal = init?.signal ?? AbortSignal.timeout(GRAPH_TIMEOUT_MS);
      return doFetch(input, { ...init, headers, signal });
    };
    const res = await send();
    if (res.status !== 401) return res;
    manager.invalidate();
    return send();
  }) as typeof fetch;
}

/** {@link getMicrosoftUserInfo} が返す本人情報。 */
export interface MicrosoftUserInfo {
  /**
   * Microsoft 側の恒久的な識別子(`id`。Entra の `oid` と同じ)。
   *
   * **紐づけにはこれを使う。** メールアドレスは変わりうる
   * (姓の変更・部署異動)し、**退職者のアドレスが再利用される**こともある。
   */
  id: string;
  /** メールアドレス(`mail`。無ければ `userPrincipalName`)。 */
  email: string;
  /** 表示名。 */
  name?: string;
  /**
   * テナント ID(組織の識別子)。
   *
   * **社内限定にするならここを確かめる。** メールアドレスの `@` 以降で
   * 判定すると、**同じドメインの個人アカウント**を弾けない。
   * `common` エンドポイントを使う場合、**他社のアカウントでもログインできる**
   * ——テナントを確認しないと**誰でも入れる**。
   */
  tenantId?: string;
}

/**
 * アクセストークンから本人情報を取る(Graph の `/me`)。
 *
 * **これだけでログインを完了させない。** トークンが有効なことと、
 * **その人がこのシステムを使ってよいこと**は別。
 * 少なくとも次を確かめること:
 *
 * 1. **テナントが自社か**(`tenantId`)——`common` を使うと他社も入れる
 * 2. **社内に登録がある人か**(`id` で自社の名簿を引く)
 * 3. **付与するロール**(Microsoft 側の権限とは別に決める)
 *
 * @param accessToken OAuth のアクセストークン
 * @param options.fetchImpl fetch の差し替え(テスト用)
 * @returns 本人情報。取得に失敗したら `null`
 *
 * @example
 * ```ts
 * const info = await getMicrosoftUserInfo(token);
 * if (info === null || info.tenantId !== env.MICROSOFT_TENANT_ID) {
 *   return new Response("この組織のアカウントではありません", { status: 403 });
 * }
 * ```
 */
export async function getMicrosoftUserInfo(
  accessToken: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<MicrosoftUserInfo | null> {
  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as {
    id?: string;
    mail?: string | null;
    userPrincipalName?: string;
    displayName?: string;
  };
  if (j.id === undefined || j.id === "") return null;
  return {
    id: j.id,
    // **`mail` が null のことがある**(ライセンス無しのアカウント)。
    // その場合は `userPrincipalName` を使う
    email: j.mail ?? j.userPrincipalName ?? "",
    ...(j.displayName !== undefined ? { name: j.displayName } : {}),
  };
}
