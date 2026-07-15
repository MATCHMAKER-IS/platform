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

/** シークレットストアを作る。 */
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

/** 環境変数プロバイダ(開発・シンプルな本番向け)。 */
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
 */
export function createFetchProvider(fetcher: (name: string) => Promise<string | null>): SecretProvider {
  return { get: fetcher };
}

/**
 * 複数プロバイダのフォールバック(先頭優先)。
 * 例: 環境変数を優先しつつ、無ければ Secrets Manager を見る。
 */
export function createChainProvider(providers: SecretProvider[]): SecretProvider {
  return {
    async get(name) {
      for (const p of providers) { const v = await p.get(name); if (v !== null) return v; }
      return null;
    },
  };
}
