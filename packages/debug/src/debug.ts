/**
 * Platform Debugger — 開発時に「1 リクエストの中で何が起きたか」を可視化する。
 *
 * ブラウザの DevTools は**ブラウザ側**しか見えない。「この画面が遅いのは SQL が 30 本
 * 走っているからか、AI 呼び出しが遅いのか」はサーバの中を見ないと分からない。
 * CakePHP の DebugKit が解いていた問題を、この基盤向けに実装したもの。
 *
 * 設計の要点:
 * - **開発時のみ**有効。本番は `enabled: false` で記録も保持もしない(メモリ・性能への影響ゼロ)。
 * - 記録先はメモリのリングバッファ。DB も外部サービスも使わない。
 * - リクエスト単位で束ねる(`@platform/context` の requestId をそのまま使う)。
 * - **基盤パッケージ側に計装を仕込まない**。呼び出し側が記録したいものだけ記録する。
 *   103 パッケージ全てに手を入れるのは非現実的で、基盤を汚すため。
 *
 * @packageDocumentation
 */

/** 記録する出来事の種類。 */
export type DebugEventKind = "sql" | "api" | "ai" | "event" | "log" | "job";

/** 1 つの出来事。 */
export interface DebugEvent {
  /** 種類。 */
  kind: DebugEventKind;
  /** 表示名(SQL なら文の要約、API なら URL など)。 */
  label: string;
  /** リクエスト開始からの経過(ms)。 */
  atMs: number;
  /** 所要時間(ms)。 */
  durationMs: number;
  /** 成功したか。 */
  ok: boolean;
  /** 補足(件数・ステータス・トークン数など。表示用)。 */
  meta?: Record<string, string | number | boolean>;
}

/** 1 リクエスト分の記録。 */
export interface DebugRequest {
  requestId: string;
  method: string;
  path: string;
  /** ステータスコード(完了後に入る)。 */
  status?: number;
  userId?: string;
  /** 開始時刻(epoch ms)。 */
  startedAt: number;
  /** 総所要時間(ms。完了後に入る)。 */
  durationMs?: number;
  events: DebugEvent[];
}

/** リクエスト 1 件の要約。 */
export interface DebugSummary {
  /** 種類別の件数。 */
  counts: Record<DebugEventKind, number>;
  /** 種類別の合計所要(ms)。 */
  durations: Record<DebugEventKind, number>;
  /** 失敗した出来事の数。 */
  failures: number;
  /** 遅い SQL(しきい値超え)の数。 */
  slowSql: number;
  /** 重複した SQL の数(N+1 の疑い)。 */
  duplicateSql: number;
}

/** 収集器。 */
export interface DebugCollector {
  /** 有効か(本番では false)。 */
  readonly enabled: boolean;
  start(req: { requestId: string; method: string; path: string; userId?: string }): void;
  record(requestId: string, event: Omit<DebugEvent, "atMs">): void;
  finish(requestId: string, status: number): void;
  /** 記録の一覧(新しい順)。 */
  list(limit?: number): DebugRequest[];
  get(requestId: string): DebugRequest | undefined;
  clear(): void;
  summarize(req: DebugRequest): DebugSummary;
}

export interface DebugCollectorOptions {
  /** 有効にするか。**本番では必ず false**。 */
  enabled: boolean;
  /** 保持するリクエスト数(既定 50)。超えたら古いものから捨てる。 */
  capacity?: number;
  /** 遅い SQL とみなすしきい値(ms。既定 100)。 */
  slowSqlMs?: number;
  /** 時刻の取得(テスト注入用)。 */
  now?: () => number;
}

const emptyCounts = (): Record<DebugEventKind, number> => ({ sql: 0, api: 0, ai: 0, event: 0, log: 0, job: 0 });

/**
 * 収集器を作る。アプリの起動時に 1 つだけ作る。
 *
 * @example
 * ```ts
 * export const debugCollector = createDebugCollector({ enabled: featureEnv.DEBUG_TOOL });
 *
 * // API の計装で
 * debugCollector.start({ requestId, method, path, userId });
 * // ... 処理 ...
 * debugCollector.finish(requestId, 200);
 * ```
 *
 * @param options 有効/無効・保持件数・遅い SQL のしきい値
 * @returns {@link DebugCollector}。**enabled が false なら全メソッドが何もしない**
 */
export function createDebugCollector(options: DebugCollectorOptions): DebugCollector {
  const enabled = options.enabled;
  const capacity = Math.max(1, options.capacity ?? 50);
  const slowSqlMs = options.slowSqlMs ?? 100;
  const now = options.now ?? Date.now;

  const buffer: DebugRequest[] = [];
  const index = new Map<string, DebugRequest>();

  const evict = (): void => {
    while (buffer.length > capacity) {
      const dropped = buffer.shift();
      if (dropped) index.delete(dropped.requestId);
    }
  };

  return {
    enabled,

    start(req) {
      if (!enabled) return;
      const entry: DebugRequest = {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        ...(req.userId ? { userId: req.userId } : {}),
        startedAt: now(),
        events: [],
      };
      buffer.push(entry);
      index.set(req.requestId, entry);
      evict();
    },

    record(requestId, event) {
      if (!enabled) return;
      const entry = index.get(requestId);
      if (!entry) return; // start されていない = 記録対象外。黙って捨てる
      entry.events.push({ ...event, atMs: now() - entry.startedAt });
    },

    finish(requestId, status) {
      if (!enabled) return;
      const entry = index.get(requestId);
      if (!entry) return;
      entry.status = status;
      entry.durationMs = now() - entry.startedAt;
    },

    list(limit = 50) {
      if (!enabled) return [];
      return buffer.slice(-limit).reverse();
    },

    get(requestId) {
      if (!enabled) return undefined;
      return index.get(requestId);
    },

    clear() {
      buffer.length = 0;
      index.clear();
    },

    summarize(req) {
      const counts = emptyCounts();
      const durations = emptyCounts();
      let failures = 0;
      let slowSql = 0;
      const sqlSeen = new Map<string, number>();

      for (const e of req.events) {
        counts[e.kind] += 1;
        durations[e.kind] += e.durationMs;
        if (!e.ok) failures += 1;
        if (e.kind === "sql") {
          if (e.durationMs >= slowSqlMs) slowSql += 1;
          sqlSeen.set(e.label, (sqlSeen.get(e.label) ?? 0) + 1);
        }
      }
      let duplicateSql = 0;
      for (const [, n] of sqlSeen) if (n > 1) duplicateSql += n - 1;

      return { counts, durations, failures, slowSql, duplicateSql };
    },
  };
}

/**
 * SQL 文を表示用に短くする。長い SQL をそのまま並べると読めないため、
 * 動詞とテーブル名だけを残す。
 *
 * @example
 * ```ts
 * summarizeSql('SELECT "id", "name" FROM "User" WHERE "id" = $1');  // => 'SELECT FROM "User"'
 * ```
 *
 * @param sql       SQL 文
 * @param maxLength 解析できなかった場合の切り詰め長(既定 80)
 * @returns 「動詞 + テーブル名」の短い文字列(解析できなければ切り詰めた元の文)
 */
export function summarizeSql(sql: string, maxLength = 80): string {
  const normalized = sql.replace(/\s+/g, " ").trim();
  const m = normalized.match(/^(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b[\s\S]*?(?:FROM\s+|INTO\s+|UPDATE\s+)?("?[\w.]+"?)/i);
  const verbMatch = normalized.match(/^(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/i);
  if (verbMatch && verbMatch[1]) {
    const verb = verbMatch[1].toUpperCase();
    // SELECT は FROM の後、それ以外は動詞の直後がテーブル名
    const tableMatch = verb === "SELECT"
      ? normalized.match(/\bFROM\s+("?[\w.]+"?)/i)
      : normalized.match(/^(?:INSERT INTO|UPDATE|DELETE FROM)\s+("?[\w.]+"?)/i);
    if (tableMatch && tableMatch[1]) {
      return verb === "SELECT" ? `SELECT FROM ${tableMatch[1]}` : `${verb} ${tableMatch[1]}`;
    }
  }
  void m;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

/**
 * 記録から「気になる点」を挙げる。
 * **実行時にしか分からないもの**だけを対象にする(静的解析は preflight/advisor の担当)。
 *
 * @param req     対象のリクエスト記録
 * @param summary {@link DebugCollector.summarize} の結果
 * @returns 気になる点の説明(空なら問題なし)。N+1・遅い SQL・1 秒超えなど
 */
export function findIssues(req: DebugRequest, summary: DebugSummary): string[] {
  const issues: string[] = [];
  if (summary.duplicateSql >= 3) {
    issues.push(`同じ SQL が繰り返し実行されています(${summary.duplicateSql + 1} 回。N+1 の疑い。include / join でまとめられませんか)`);
  }
  if (summary.slowSql > 0) {
    issues.push(`遅い SQL が ${summary.slowSql} 本あります(インデックスを確認してください)`);
  }
  if (summary.counts.sql > 20) {
    issues.push(`SQL が ${summary.counts.sql} 本です(1 リクエストで多すぎます)`);
  }
  if (summary.failures > 0) {
    issues.push(`失敗した処理が ${summary.failures} 件あります`);
  }
  if (req.durationMs !== undefined && req.durationMs > 1000) {
    const entries = Object.entries(summary.durations) as [DebugEventKind, number][];
    const heaviest = entries.sort((a, b) => b[1] - a[1])[0];
    if (heaviest && heaviest[1] > 0) {
      issues.push(`${Math.round(req.durationMs)}ms かかっています(内訳: ${heaviest[0]} が ${Math.round(heaviest[1])}ms)`);
    }
  }
  return issues;
}
