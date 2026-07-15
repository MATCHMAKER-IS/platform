/**
 * リプレイ攻撃防止(ワンタイム値ストア)。
 * 一度使ったトークン ID(JWT の jti)・nonce・冪等キーなどの再利用を拒否する。
 * 出典: 社内 universe-club の JWT jti 再利用拒否ストアを、ストア注入式に一般化。
 *
 * 設計方針: プロセス内メモリ実装を同梱しつつ、本番のマルチインスタンスでは
 * Redis / DynamoDB TTL などの分散ストアに差し替えられるよう `ReplayStore` を抽象化する。
 * API(markUsedIfNew)を維持すれば呼び出し側の変更は不要。
 * @packageDocumentation
 */

/** ワンタイム値の記録先。TTL 付きで「初見なら記録して true、既知なら false」を返せれば良い。 */
export interface ReplayStore {
  /** id を expiresAtMs まで記録。初見なら true(記録成功)、既に存在すれば false。 */
  markIfNew(id: string, expiresAtMs: number): Promise<boolean> | boolean;
}

/** リプレイ防止ガード。 */
export interface ReplayGuard {
  /**
   * 値を「使用済み」としてマークする。初見なら true(=処理を続行してよい)、
   * 再利用なら false(=401 等で拒否する)。
   * @param id 一意な値(jti / nonce / 冪等キー)
   * @param expiresAtSec この値の有効期限(UNIX 秒)。省略時は既定 TTL を使う。
   */
  markUsedIfNew(id: string, expiresAtSec?: number): Promise<boolean>;
}

/** メモリ実装のオプション。 */
export interface MemoryReplayStoreOptions {
  now?: () => number;
}

/** プロセス内メモリの ReplayStore(単一インスタンス向け)。期限切れは遅延パージ。 */
export function createMemoryReplayStore(options: MemoryReplayStoreOptions = {}): ReplayStore {
  const now = options.now ?? (() => Date.now());
  const store = new Map<string, number>();
  return {
    markIfNew(id, expiresAtMs) {
      const t = now();
      // 遅延パージ
      for (const [key, exp] of store) if (exp <= t) store.delete(key);
      if (store.has(id)) return false;
      store.set(id, expiresAtMs);
      return true;
    },
  };
}

/** ガードのオプション。 */
export interface ReplayGuardOptions {
  /** 既定 TTL(ミリ秒)。expiresAtSec 未指定時、および exp が近すぎる場合の下限として使う。既定 360 秒。 */
  ttlMs?: number;
  /** クロックスキュー吸収(ミリ秒)。exp にこの分を足して記録する。既定 60 秒。 */
  clockSkewMs?: number;
  now?: () => number;
}

/**
 * リプレイ防止ガードを作る。ストアを注入する(既定はメモリ)。
 *
 * @example
 * ```ts
 * const guard = createReplayGuard(); // メモリ
 * // JWT 検証後:
 * if (!(await guard.markUsedIfNew(payload.jti, payload.exp))) {
 *   return new Response("token replay", { status: 401 });
 * }
 * ```
 * 本番(複数インスタンス)では Redis 実装を渡す:
 * ```ts
 * const guard = createReplayGuard({}, createRedisReplayStore(redis));
 * ```
 */
export function createReplayGuard(options: ReplayGuardOptions = {}, store?: ReplayStore): ReplayGuard {
  const now = options.now ?? (() => Date.now());
  const ttlMs = options.ttlMs ?? 360_000;
  const skewMs = options.clockSkewMs ?? 60_000;
  const backend = store ?? createMemoryReplayStore({ now });
  return {
    async markUsedIfNew(id, expiresAtSec) {
      const t = now();
      const fromExp = expiresAtSec !== undefined ? expiresAtSec * 1000 + skewMs : 0;
      const expiresAtMs = Math.max(fromExp, t + ttlMs);
      return await backend.markIfNew(id, expiresAtMs);
    },
  };
}
