/**
 * RPA 安全実行の共通部品(ランナー骨格)。
 *
 * 基盤は RPA 本体(ブラウザ自動操作など)は持たない。壁打ちの優先順位は **API > MCP > RPA** で、
 * RPA は最後の手段。だが RPA を回すときに毎回必要になる「安全に実行するための枠組み」——
 * 直列化(同一リソースの同時実行防止)・リトライ・監査記録・タイムアウト・冪等キー——を共通化する。
 *
 * 実際のロック実装は注入する(単一ホストなら @platform/cron の createFileLockStore、
 * 複数インスタンスなら createRedisLockStore)。監査シンクも注入する(@platform/audit 等)。
 * これにより本パッケージは外部依存ゼロ(core のみ)で、環境非依存にテストできる。
 * @packageDocumentation
 */
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

/** ロックの最小契約(@platform/cron の LockStore と構造互換)。 */
export interface RpaLock {
  acquire(key: string, ttlMs: number): Promise<boolean> | boolean;
  release(key: string): Promise<void> | void;
}

/** 監査イベント(@platform/audit の AuditEvent と構造互換の最小形)。 */
export interface RpaAuditEvent {
  action: string;
  target?: string;
  actor?: string;
  at: string;
  metadata?: Record<string, unknown>;
}

/** 監査シンク(記録先)。配列に push でも、@platform/audit へ流しても良い。 */
export type RpaAuditSink = (event: RpaAuditEvent) => void | Promise<void>;

/** RPA 実行の文脈。ジョブ本体に渡る。 */
export interface RpaContext {
  /** この実行の一意 ID。 */
  runId: string;
  /** 試行回数(1 始まり)。 */
  attempt: number;
  /** 監査イベントを記録する(action と任意の詳細)。 */
  audit(action: string, metadata?: Record<string, unknown>): Promise<void>;
  /** 中断が要求されたら true(タイムアウト時など)。長い処理はこれを見て早期終了できる。 */
  signal: { aborted: boolean };
}

/** リトライ設定。 */
export interface RpaRetryOptions {
  /** 最大試行回数(既定 1 = リトライなし)。 */
  maxAttempts?: number;
  /** 指数バックオフの基準ミリ秒(既定 1000)。attempt 番目の待機 = baseDelayMs * 2^(attempt-1)。 */
  baseDelayMs?: number;
  /** リトライ対象か判定(既定: すべてのエラーを再試行)。 */
  isRetryable?: (error: unknown) => boolean;
}

/** RPA タスク定義。 */
export interface RpaTask<T> {
  /** タスク名(監査・ログに出る)。 */
  name: string;
  /**
   * 直列化キー。同じキーのタスクは同時に走らない(例: "chromium" で全ブラウザ RPA を直列化)。
   * 省略時は直列化しない。
   */
  lockKey?: string;
  /** ロック確保の TTL(既定 5 分)。 */
  lockTtlMs?: number;
  /** ロック取得の待機上限(既定 0 = 待たずに、取れなければ CONFLICT)。 */
  lockWaitMs?: number;
  /** タスク全体のタイムアウト(既定 なし)。超えると signal.aborted=true にし、TIMEOUT を返す。 */
  timeoutMs?: number;
  /** 冪等キー。同じキーで既に成功済みなら実行をスキップ(runOnce に記憶を注入)。 */
  idempotencyKey?: string;
  retry?: RpaRetryOptions;
  /** 実処理。ctx を通じて監査・中断確認ができる。 */
  run(ctx: RpaContext): Promise<T>;
}

/** ランナーの依存。 */
export interface RpaRunnerOptions {
  lock?: RpaLock;
  audit?: RpaAuditSink;
  /** 冪等記憶(成功した idempotencyKey を覚える)。省略時は冪等スキップ無効。 */
  seenStore?: { has(key: string): Promise<boolean> | boolean; add(key: string): Promise<void> | void };
  now?: () => number;
  /** 乱数 runId 生成(テスト用に差し替え可能)。 */
  genRunId?: () => string;
  /** 待機関数(テスト用)。 */
  sleep?: (ms: number) => Promise<void>;
  actor?: string;
}

/** 実行結果の詳細。 */
export interface RpaRunResult<T> {
  runId: string;
  attempts: number;
  /** 冪等キーで実行がスキップされたら true。 */
  skipped: boolean;
  value: T | undefined;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * RPA ランナーを作る。返り値の `run` は、直列化・冪等・タイムアウト・リトライ・監査を
 * まとめて面倒みる。RPA 本体(task.run)はビジネスロジックだけ書けばよい。
 *
 * @example
 * ```ts
 * import { createFileLockStore } from "@platform/cron";
 * const runner = createRpaRunner({ lock: createFileLockStore(".cache/rpa"), audit: sink });
 * const res = await runner.run({
 *   name: "point-sync",
 *   lockKey: "chromium",         // 他のブラウザ RPA と直列化
 *   timeoutMs: 120_000,
 *   retry: { maxAttempts: 3 },
 *   idempotencyKey: "2025-01-daily",
 *   run: async (ctx) => {
 *     await ctx.audit("open_browser");
 *     if (ctx.signal.aborted) return;
 *     // ... 実処理 ...
 *   },
 * });
 * ```
 * @param options.browser ブラウザの実装(**Playwright などを注入**)
 * @param options.timeoutMs 各操作のタイムアウト
 */
export function createRpaRunner(options: RpaRunnerOptions = {}) {
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? defaultSleep;
  const genRunId = options.genRunId ?? (() => `run_${now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);

  async function emit(event: RpaAuditEvent): Promise<void> {
    if (options.audit) await options.audit(event);
  }

  return {
    async run<T>(task: RpaTask<T>): Promise<Result<RpaRunResult<T>>> {
      const runId = genRunId();
      const baseMeta = { task: task.name, runId };

      // 冪等スキップ
      if (task.idempotencyKey && options.seenStore) {
        if (await options.seenStore.has(task.idempotencyKey)) {
          await emit({ action: "rpa.skip", target: task.name, ...(options.actor ? { actor: options.actor } : {}), at: new Date(now()).toISOString(), metadata: { ...baseMeta, idempotencyKey: task.idempotencyKey } });
          return ok({ runId, attempts: 0, skipped: true, value: undefined });
        }
      }

      // ロック確保(直列化)
      let locked = false;
      if (task.lockKey && options.lock) {
        const ttl = task.lockTtlMs ?? 5 * 60_000;
        const waitDeadline = now() + (task.lockWaitMs ?? 0);
        for (;;) {
          locked = await options.lock.acquire(task.lockKey, ttl);
          if (locked) break;
          if (now() >= waitDeadline) {
            await emit({ action: "rpa.lock_timeout", target: task.name, at: new Date(now()).toISOString(), metadata: { ...baseMeta, lockKey: task.lockKey } });
            return err(new AppError(ErrorCode.CONFLICT, `RPA タスク ${task.name} はロック ${task.lockKey} を取得できませんでした`));
          }
          await sleep(Math.min(1000, Math.max(0, waitDeadline - now())));
        }
      }

      const signal = { aborted: false };
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (task.timeoutMs !== undefined) {
        timer = setTimeout(() => { signal.aborted = true; }, task.timeoutMs);
      }

      const maxAttempts = Math.max(1, task.retry?.maxAttempts ?? 1);
      const baseDelay = task.retry?.baseDelayMs ?? 1000;
      const isRetryable = task.retry?.isRetryable ?? (() => true);

      try {
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          const ctx: RpaContext = {
            runId,
            attempt,
            signal,
            audit: (action, metadata) => emit({ action, target: task.name, ...(options.actor ? { actor: options.actor } : {}), at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt, ...(metadata ?? {}) } }),
          };
          await emit({ action: "rpa.start", target: task.name, ...(options.actor ? { actor: options.actor } : {}), at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt } });
          try {
            const value = await task.run(ctx);
            if (signal.aborted) {
              await emit({ action: "rpa.timeout", target: task.name, at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt } });
              return err(new AppError(ErrorCode.INTERNAL, `RPA タスク ${task.name} がタイムアウトしました`, { details: { runId } }));
            }
            if (task.idempotencyKey && options.seenStore) await options.seenStore.add(task.idempotencyKey);
            await emit({ action: "rpa.success", target: task.name, at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt } });
            return ok({ runId, attempts: attempt, skipped: false, value });
          } catch (e) {
            lastError = e;
            const message = e instanceof Error ? e.message : String(e);
            await emit({ action: "rpa.error", target: task.name, at: new Date(now()).toISOString(), metadata: { ...baseMeta, attempt, error: message } });
            if (signal.aborted) {
              return err(new AppError(ErrorCode.INTERNAL, `RPA タスク ${task.name} がタイムアウトしました`, { details: { runId } }));
            }
            if (attempt < maxAttempts && isRetryable(e)) {
              await sleep(baseDelay * 2 ** (attempt - 1));
              continue;
            }
            break;
          }
        }
        const message = lastError instanceof Error ? lastError.message : String(lastError);
        return err(new AppError(ErrorCode.EXTERNAL, `RPA タスク ${task.name} が失敗しました: ${message}`, { details: { runId, attempts: maxAttempts } }));
      } finally {
        if (timer) clearTimeout(timer);
        if (locked && task.lockKey && options.lock) await options.lock.release(task.lockKey);
      }
    },
  };
}
