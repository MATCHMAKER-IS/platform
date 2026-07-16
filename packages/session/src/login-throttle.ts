/**
 * ログイン試行の抑制(ブルートフォース対策)。
 * 識別子(メール/IP)ごとに失敗回数を数え、閾値を超えたら一定時間ロックする。
 * 段階的バックオフにも対応。ストアは注入(メモリ/Redis 等)。
 * @packageDocumentation
 */

/** 試行記録。 */
export interface AttemptRecord {
  fails: number;
  /** 直近失敗時刻(epoch ms)。 */
  lastFailAt: number;
  /** ロック解除時刻(epoch ms)。0 ならロックなし。 */
  lockedUntil: number;
}

/** 試行記録ストア(キーは識別子)。 */
export interface ThrottleStore {
  get(key: string): Promise<AttemptRecord | null> | AttemptRecord | null;
  set(key: string, record: AttemptRecord, ttlMs: number): Promise<void> | void;
  delete(key: string): Promise<void> | void;
}

/** {@link createLoginThrottle} の設定。 */
export interface LoginThrottleConfig {
  /** ロックまでの許容失敗回数(既定 5)。 */
  maxFails?: number;
  /** 失敗カウントの観測窓(ミリ秒、既定 15 分)。この時間 失敗が無ければリセット。 */
  windowMs?: number;
  /** 基本ロック時間(ミリ秒、既定 15 分)。 */
  lockMs?: number;
  /**
   * 段階的バックオフ。true なら 超過回数に応じてロック時間を倍化(lockMs × 2^n)。
   * 既定 false(固定 lockMs)。
   */
  progressive?: boolean;
  /** ロック時間の上限(ミリ秒、既定 24 時間)。 */
  maxLockMs?: number;
  store: ThrottleStore;
  now?: () => number;
}

/** ログインチェックの結果。 */
export interface ThrottleCheck {
  /** 試行を許可するか。 */
  allowed: boolean;
  /** ロック中の残り時間(ミリ秒)。allowed=false のとき有効。 */
  retryAfterMs?: number;
  /** 残り試行回数(allowed=true のとき)。 */
  remaining?: number;
}

/**
 * ログイン試行の制限を作る(総当たり攻撃への対策)。
 *
 * **失敗が続いたらしばらく受け付けない**。これが無いと、パスワードを機械的に
 * 試され続ける。
 *
 * @param store 試行回数の保存先
 * @param options.maxAttempts 何回失敗したらロックするか
 * @param options.windowMs 試行を数える期間
 * @param options.lockMs ロックする時間
 * @returns スロットル。`check` で判定、`record` で結果を記録
 */
export function createLoginThrottle(config: LoginThrottleConfig) {
  const maxFails = config.maxFails ?? 5;
  const windowMs = config.windowMs ?? 15 * 60 * 1000;
  const lockMs = config.lockMs ?? 15 * 60 * 1000;
  const maxLockMs = config.maxLockMs ?? 24 * 60 * 60 * 1000;
  const progressive = config.progressive ?? false;
  const now = config.now ?? (() => Date.now());
  const store = config.store;

  return {
    /** ログイン試行の前に呼ぶ。ロック中なら allowed=false。 */
    async check(key: string): Promise<ThrottleCheck> {
      const rec = await store.get(key);
      if (!rec) return { allowed: true, remaining: maxFails };
      if (rec.lockedUntil > now()) {
        return { allowed: false, retryAfterMs: rec.lockedUntil - now() };
      }
      // 観測窓を超えていれば実質リセット
      if (now() - rec.lastFailAt > windowMs) return { allowed: true, remaining: maxFails };
      return { allowed: true, remaining: Math.max(0, maxFails - rec.fails) };
    },

    /** 認証失敗時に呼ぶ。閾値超過でロックする。 */
    async recordFailure(key: string): Promise<ThrottleCheck> {
      const prev = await store.get(key);
      const withinWindow = prev && now() - prev.lastFailAt <= windowMs;
      const fails = (withinWindow ? prev!.fails : 0) + 1;
      let lockedUntil = 0;
      if (fails >= maxFails) {
        const over = fails - maxFails; // 超過回数
        const dur = progressive ? Math.min(lockMs * 2 ** over, maxLockMs) : lockMs;
        lockedUntil = now() + dur;
      }
      const rec: AttemptRecord = { fails, lastFailAt: now(), lockedUntil };
      await store.set(key, rec, Math.max(windowMs, lockedUntil - now()));
      return lockedUntil > now()
        ? { allowed: false, retryAfterMs: lockedUntil - now() }
        : { allowed: true, remaining: Math.max(0, maxFails - fails) };
    },

    /** 認証成功時に呼ぶ。カウントをクリアする。 */
    async recordSuccess(key: string): Promise<void> {
      await store.delete(key);
    },
  };
}

/**
 * 試行回数ストアのメモリ実装(単一プロセス・テスト用)。
 *
 * **複数プロセスでは使えない**(プロセスごとに別のメモリを持つため、
 * 攻撃者は別のプロセスに当たれば制限を回避できる)。**本番では Redis 実装を注入すること**。
 *
 * @param options.now 時刻の取得(テスト注入用)
 * @returns 試行回数ストア
 */
export function createMemoryThrottleStore(now: () => number = () => Date.now()): ThrottleStore {
  const map = new Map<string, { record: AttemptRecord; expiresAt: number }>();
  return {
    get(key) {
      const e = map.get(key);
      if (!e) return null;
      if (e.expiresAt <= now()) { map.delete(key); return null; }
      return e.record;
    },
    set(key, record, ttlMs) { map.set(key, { record, expiresAt: now() + ttlMs }); },
    delete(key) { map.delete(key); },
  };
}
