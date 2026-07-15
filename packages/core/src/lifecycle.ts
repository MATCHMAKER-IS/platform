/**
 * プロセスのライフサイクル管理。SIGTERM/SIGINT を受けたら、登録した終了処理を
 * 逆順で実行してから終了する。Kubernetes/ECS のゼロダウンタイムデプロイに必須。
 *
 * 典型的な流れ: (1) 新規リクエスト受付停止 → (2) 進行中の完了待ち → (3) DB/Redis/キュー切断。
 * @packageDocumentation
 */

/** 終了時に実行する後始末。名前は診断ログ用。 */
export interface ShutdownHook {
  name: string;
  handler: () => Promise<void> | void;
}

/** シャットダウン管理。 */
export interface Lifecycle {
  /** 後始末を登録する(登録の逆順で実行される)。 */
  onShutdown(name: string, handler: () => Promise<void> | void): void;
  /** 手動でシャットダウンを開始する(テスト・明示終了用)。二重呼び出しは無視。 */
  shutdown(reason: string): Promise<void>;
  /** シャットダウン中か(新規受付を止める判定に使う)。 */
  isShuttingDown(): boolean;
  /** SIGTERM/SIGINT を購読する。 */
  install(): void;
}

/** ロガーの最小形。 */
interface LoggerLike { info(o: unknown, m?: string): void; error(o: unknown, m?: string): void }

/** {@link createLifecycle} のオプション。 */
export interface LifecycleOptions {
  /** 各フックのタイムアウト(ms、既定 10000)。超過したフックは打ち切って次へ。 */
  hookTimeoutMs?: number;
  /** シャットダウン完了後に process.exit するか(既定 true)。テストでは false。 */
  exitProcess?: boolean;
  logger?: LoggerLike;
  /** シグナル購読の対象(テスト用に差し替え可能)。 */
  onSignal?: (signal: string, cb: () => void) => void;
  /** 終了関数(テスト用)。 */
  exit?: (code: number) => void;
}

function withTimeout(p: Promise<void> | void, ms: number): Promise<void> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error(`shutdown hook timeout after ${ms}ms`)), ms)),
  ]);
}

/**
 * ライフサイクル管理を作る。
 *
 * 「終了シグナルを受けたら、処理中のものを待ってから安全に落とす」を実現する。
 * これが無いと、デプロイのたびに処理中のリクエストが切れる。
 *
 * @param options タイムアウト・ログ出力先など(省略可)
 * @returns {@link Lifecycle}(`onShutdown` で後片付けを登録、`shutdown` で実行)
 *
 * @example
 * ```ts
 * const lifecycle = createLifecycle({ timeoutMs: 10_000 });
 * lifecycle.onShutdown(async () => { await db.$disconnect(); });
 * // SIGTERM を受けたら登録順の逆で実行される
 * ```
 */
export function createLifecycle(options: LifecycleOptions = {}): Lifecycle {
  const hookTimeoutMs = options.hookTimeoutMs ?? 10_000;
  const exitProcess = options.exitProcess ?? true;
  const log = options.logger ?? { info: () => {}, error: () => {} };
  const onSignal = options.onSignal ?? ((sig, cb) => { (globalThis as { process?: { on(s: string, cb: () => void): void } }).process?.on(sig, cb); });
  const exit = options.exit ?? ((code: number) => { (globalThis as { process?: { exit(c: number): void } }).process?.exit(code); });

  const hooks: ShutdownHook[] = [];
  let shuttingDown = false;

  async function shutdown(reason: string): Promise<void> {
    if (shuttingDown) return; // 二重実行防止(SIGTERM 連打対策)
    shuttingDown = true;
    log.info({ reason }, "シャットダウン開始");
    // 登録の逆順(依存の後→先)で後始末
    for (const hook of [...hooks].reverse()) {
      try { await withTimeout(hook.handler(), hookTimeoutMs); log.info({ hook: hook.name }, "後始末完了"); }
      catch (e) { log.error({ hook: hook.name, error: e instanceof Error ? e.message : String(e) }, "後始末に失敗"); }
    }
    log.info({ reason }, "シャットダウン完了");
    if (exitProcess) exit(0);
  }

  return {
    onShutdown(name, handler) { hooks.push({ name, handler }); },
    shutdown,
    isShuttingDown: () => shuttingDown,
    install() {
      onSignal("SIGTERM", () => void shutdown("SIGTERM"));
      onSignal("SIGINT", () => void shutdown("SIGINT"));
    },
  };
}
