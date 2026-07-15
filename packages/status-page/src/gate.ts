/**
 * メンテナンス切り替えゲート(依存ゼロ)。
 * 「今メンテナンス中か」を判定し、middleware が通常応答かメンテナンス画面かを分岐するための決定を返す。
 * オン/オフの情報源は注入(env / フラグ / 設定ストア)。ヘルスチェック・管理者・許可パスは素通しできる。
 * 予定時刻(開始・終了)による自動オン/オフにも対応。
 * @packageDocumentation
 */

/** ゲート判定に渡すリクエスト情報。 */
export interface MaintenanceRequestInfo {
  /** リクエストパス(例 "/api/health")。 */
  path: string;
  /** クライアント IP(許可 IP 判定用。任意)。 */
  ip?: string;
  /** ロール(管理者素通し用。任意)。 */
  roles?: string[];
  /** 任意のヘッダ取得関数(バイパストークン判定等)。 */
  getHeader?: (name: string) => string | null | undefined;
}

/** メンテナンスの構成。 */
export interface MaintenanceConfig {
  /** 手動フラグ。true でメンテナンス。情報源(env/フラグ)から供給する。 */
  enabled?: boolean;
  /** 予定メンテナンス期間(ISO 文字列)。現在時刻がこの範囲内なら自動的にオン。 */
  window?: { start: string; end: string };
  /** 素通しするパスの接頭辞(既定: ヘルスチェック・静的アセット)。 */
  allowPaths?: string[];
  /** 素通しする IP(社内 IP・監視系)。 */
  allowIps?: string[];
  /** 素通しするロール(管理者は保守中も操作できる)。 */
  allowRoles?: string[];
  /** バイパス用ヘッダ名と期待値(例 x-maintenance-bypass)。 */
  bypassHeader?: { name: string; value: string };
  /** 復旧予定の表示文言(画面に出す)。 */
  estimatedRecovery?: string;
  /** Retry-After 秒(既定 3600)。 */
  retryAfterSeconds?: number;
}

/** ゲートの判定結果。 */
export interface MaintenanceDecision {
  /** メンテナンス画面を出すべきか。 */
  active: boolean;
  /** active=false のときの理由(バイパス理由など。ログ用)。 */
  reason?: "disabled" | "allow_path" | "allow_ip" | "allow_role" | "bypass_header" | "out_of_window";
  /** レスポンスに付けるべき Retry-After 秒(active=true 時)。 */
  retryAfterSeconds?: number;
  estimatedRecovery?: string;
}

const DEFAULT_ALLOW_PATHS = ["/api/health", "/api/healthz", "/_next/", "/favicon.ico"];

/** 現在メンテナンス扱いにすべき時間帯かを判定する(手動フラグ or 予定期間)。 */
export function isInMaintenanceWindow(config: MaintenanceConfig, now: Date): boolean {
  if (config.enabled) return true;
  if (config.window) {
    const t = now.getTime();
    const start = Date.parse(config.window.start);
    const end = Date.parse(config.window.end);
    if (!Number.isNaN(start) && !Number.isNaN(end) && t >= start && t < end) return true;
  }
  return false;
}

/** メンテナンスゲートを作る。config は都度評価(情報源を注入して最新値を反映)。 */
export function createMaintenanceGate(getConfig: () => MaintenanceConfig, now: () => Date = () => new Date()) {
  return {
    /** リクエストごとに判定する。 */
    evaluate(req: MaintenanceRequestInfo): MaintenanceDecision {
      const config = getConfig();
      const retryAfterSeconds = config.retryAfterSeconds ?? 3600;

      // メンテ時間帯でなければ即通常応答
      if (!isInMaintenanceWindow(config, now())) return { active: false, reason: "out_of_window" };

      // 素通し(ヘルスチェック・静的・許可パス)
      const allowPaths = config.allowPaths ?? DEFAULT_ALLOW_PATHS;
      if (allowPaths.some((p) => req.path === p || req.path.startsWith(p))) {
        return { active: false, reason: "allow_path" };
      }
      // バイパスヘッダ(運用者が保守中に確認する用)
      if (config.bypassHeader && req.getHeader) {
        const v = req.getHeader(config.bypassHeader.name);
        if (v && v === config.bypassHeader.value) return { active: false, reason: "bypass_header" };
      }
      // 許可 IP
      if (config.allowIps && req.ip && config.allowIps.includes(req.ip)) {
        return { active: false, reason: "allow_ip" };
      }
      // 許可ロール(管理者)
      if (config.allowRoles && req.roles && req.roles.some((r) => config.allowRoles!.includes(r))) {
        return { active: false, reason: "allow_role" };
      }
      // それ以外はメンテナンス画面
      return { active: true, retryAfterSeconds, ...(config.estimatedRecovery ? { estimatedRecovery: config.estimatedRecovery } : {}) };
    },
  };
}

// ─────────────────────────── GUI/ストア連動(再起動なしの切り替え)───────────────────────────

/**
 * 永続化されるメンテナンス状態(管理画面から書き換える対象)。
 * 静的なポリシー(許可ロール/IP 等)とは分け、切り替えに関わる値だけを持つ。
 */
export interface MaintenanceState {
  enabled: boolean;
  window?: { start: string; end: string };
  estimatedRecovery?: string;
  /** 画面に出す任意メッセージ(未指定なら既定文言)。 */
  message?: string | string[];
  /** 監査用: 最終更新者・時刻。 */
  updatedBy?: string;
  updatedAt?: string;
}

/** 永続化ストアの最小インターフェース(DB 等はアプリ側で実装)。 */
export interface MaintenanceStore {
  get(): Promise<MaintenanceState> | MaintenanceState;
  set(state: MaintenanceState): Promise<void> | void;
}

/** 保存状態と静的ポリシー(許可ロール/IP/バイパス)を合成して MaintenanceConfig にする。 */
export function stateToConfig(state: MaintenanceState, policy?: Omit<MaintenanceConfig, "enabled" | "window" | "estimatedRecovery">): MaintenanceConfig {
  return {
    ...(policy ?? {}),
    enabled: state.enabled,
    ...(state.window ? { window: state.window } : {}),
    ...(state.estimatedRecovery ? { estimatedRecovery: state.estimatedRecovery } : {}),
  };
}

/**
 * 非同期の設定源(DB/フラグ/リモート)に対応したメンテナンスゲート。
 * middleware は毎リクエスト評価するため、実運用では {@link createCachedConfig} と併用して
 * ストアアクセスを間引くこと。
 */
export function createAsyncMaintenanceGate(
  getConfig: () => MaintenanceConfig | Promise<MaintenanceConfig>,
  now: () => Date = () => new Date(),
) {
  const sync = (config: MaintenanceConfig, req: MaintenanceRequestInfo): MaintenanceDecision =>
    createMaintenanceGate(() => config, now).evaluate(req);
  return {
    async evaluate(req: MaintenanceRequestInfo): Promise<MaintenanceDecision> {
      const config = await getConfig();
      return sync(config, req);
    },
  };
}

/**
 * 非同期フェッチを TTL でキャッシュするラッパー(middleware がストアを叩きすぎないように)。
 * @param fetch 設定/状態を取得する関数
 * @param ttlMs キャッシュ有効期間(既定 5 秒)
 */
export function createCachedConfig<T>(fetch: () => Promise<T> | T, ttlMs = 5000, now: () => number = () => Date.now()): () => Promise<T> {
  let cached: T | undefined;
  let expiresAt = 0;
  let inflight: Promise<T> | null = null;
  return async () => {
    if (cached !== undefined && now() < expiresAt) return cached;
    if (!inflight) {
      inflight = Promise.resolve(fetch()).then((v) => {
        cached = v;
        expiresAt = now() + ttlMs;
        inflight = null;
        return v;
      }).catch((e) => { inflight = null; throw e; });
    }
    return inflight;
  };
}

/** 参照用のメモリ実装(テスト/デモ向け。本番は DB 実装をアプリ側で)。 */
export function createMemoryMaintenanceStore(initial?: Partial<MaintenanceState>): MaintenanceStore {
  let state: MaintenanceState = { enabled: false, ...initial };
  return {
    get: () => state,
    set: (s) => { state = { ...s, updatedAt: s.updatedAt ?? new Date().toISOString() }; },
  };
}
