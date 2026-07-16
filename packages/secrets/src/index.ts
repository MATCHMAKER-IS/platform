/**
 * `@platform/secrets` — シークレット取得の抽象。
 *
 * 環境変数の平文直読みを避け、取得元(env / AWS Secrets Manager / Vault 等)を差し替え可能にする。
 * キャッシュと TTL による自動リフレッシュ(ローテーション追随)、必須チェック、参照時の遅延取得を提供。
 * 値はログに出さない前提で扱う(logger の redact と併用)。
 * @packageDocumentation
 */

/** シークレット取得元(プロバイダ)。 */
export interface SecretProvider {
  /** 名前でシークレットを取得(無ければ null)。 */
  get(name: string): Promise<string | null>;
}

/** シークレットストア(キャッシュ・TTL・必須チェック付き)。 */
export interface SecretStore {
  /** 取得(TTL 内はキャッシュ)。無ければ null。 */
  get(name: string): Promise<string | null>;
  /** 必須取得(無ければ例外)。起動時の検証にも使う。 */
  require(name: string): Promise<string>;
  /** キャッシュを捨てて次回に再取得させる(ローテーション直後などに)。 */
  invalidate(name?: string): void;
}

/** {@link createSecretStore} のオプション。 */
export interface SecretStoreOptions {
  /** キャッシュ TTL(ms、既定 5 分)。0 でキャッシュ無効。ローテーション頻度に合わせる。 */
  ttlMs?: number;
  now?: () => number;
}

/**
 * シークレットストアを作る。
 *
 * **取得元を差し替えられる**(env・AWS Secrets Manager・Vault)。
 * アプリのコードは変えずに、環境ごとに提供元を変えられる。
 *
 * @param provider 取得元
 * @param options.cacheTtlMs キャッシュの有効期間(**外部サービスを毎回叩かない**)
 * @returns ストア(`get` で取得)
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 必須のシークレットが見つからない場合(`get` 実行時)
 */
export function createSecretStore(provider: SecretProvider, options: SecretStoreOptions = {}): SecretStore {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  const now = options.now ?? (() => Date.now());
  const cache = new Map<string, { value: string | null; expiresAt: number }>();

  async function get(name: string): Promise<string | null> {
    const cached = cache.get(name);
    if (cached && cached.expiresAt > now()) return cached.value;
    const value = await provider.get(name);
    if (ttlMs > 0) cache.set(name, { value, expiresAt: now() + ttlMs });
    return value;
  }

  return {
    get,
    async require(name) {
      const v = await get(name);
      if (v === null || v === "") throw new Error(`必須シークレット「${name}」が未設定です`);
      return v;
    },
    invalidate(name) {
      if (name === undefined) cache.clear();
      else cache.delete(name);
    },
  };
}

/**
 * 環境変数から取得するプロバイダ(開発・シンプルな本番向け)。
 *
 * **プロセスの環境変数は他のプロセスから見える**(`ps e` など)。
 * 機密度が高いなら Secrets Manager などを使うこと。
 *
 * @param env 環境変数(既定は `process.env`)
 * @returns プロバイダ
 */
export function createEnvProvider(env: Record<string, string | undefined> = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}): SecretProvider {
  return { get: async (name) => env[name] ?? null };
}

/**
 * 汎用の非同期フェッチャプロバイダ。AWS Secrets Manager / Vault 等の SDK 呼び出しを包む。
 * @example
 * ```ts
 * const provider = createFetchProvider(async (name) => {
 *   const r = await secretsManager.getSecretValue({ SecretId: name });
 *   return r.SecretString ?? null;
 * });
 * ```
 *
 * @param options.endpoint 取得先の URL
 * @param options.headers 認証ヘッダ
 * @returns プロバイダ(**Secrets Manager など HTTP API 経由**)
 */
export function createFetchProvider(fetcher: (name: string) => Promise<string | null>): SecretProvider {
  return { get: fetcher };
}

/**
 * 複数プロバイダのフォールバック(先頭優先)。
 * 例: 環境変数を優先しつつ、無ければ Secrets Manager を見る。
 *
 * @param providers プロバイダの配列
 * @returns 連鎖プロバイダ。**先に見つかったものを使う**(env → Secrets Manager の順で探す、といった構成に)
 */
export function createChainProvider(providers: SecretProvider[]): SecretProvider {
  return {
    async get(name) {
      for (const p of providers) { const v = await p.get(name); if (v !== null) return v; }
      return null;
    },
  };
}
