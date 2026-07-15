/**
 * プロセスレベルの安全網。未処理の Promise 拒否・捕捉されない例外を記録し、
 * 危険な状態(uncaughtException)では graceful に終了する。
 * これが無いと、未処理例外がログも残さずプロセスを不定状態にし得る。
 * @packageDocumentation
 */

/** ロガーの最小形。 */
interface LoggerLike { error(o: unknown, m?: string): void; warn(o: unknown, m?: string): void }

/** {@link installProcessGuards} のオプション。 */
export interface ProcessGuardOptions {
  logger?: LoggerLike;
  /** uncaughtException 時に呼ぶ後始末(graceful shutdown)。 */
  onFatal?: (error: Error) => Promise<void> | void;
  /** uncaughtException 後にプロセスを終了するか(既定 true)。 */
  exitOnUncaught?: boolean;
  /** イベント購読(テスト差し替え用)。 */
  onProcess?: (event: string, handler: (...args: unknown[]) => void) => void;
  exit?: (code: number) => void;
}

/**
 * プロセスの安全網を設置する。
 * - unhandledRejection: 記録のみ(プロセスは継続)。原因を可視化して修正につなげる。
 * - uncaughtException: 記録 → onFatal(shutdown)→ 終了(不定状態での継続を避ける)。
 *
 * @param options ログ出力先・致命時の後片付け(省略時は console と即終了)
 * @returns なし(プロセスにハンドラを設置する副作用のみ)
 *
 * @example
 * ```ts
 * installProcessGuards({ log, onFatal: () => lifecycle.shutdown() });
 * ```
 */
export function installProcessGuards(options: ProcessGuardOptions = {}): void {
  const log = options.logger ?? { error: () => {}, warn: () => {} };
  const exitOnUncaught = options.exitOnUncaught ?? true;
  const onProcess = options.onProcess ?? ((event, handler) => { (globalThis as { process?: { on(e: string, h: (...a: unknown[]) => void): void } }).process?.on(event, handler); });
  const exit = options.exit ?? ((code: number) => { (globalThis as { process?: { exit(c: number): void } }).process?.exit(code); });

  onProcess("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    log.error({ message: error.message, stack: error.stack }, "未処理の Promise 拒否");
  });

  let handlingFatal = false;
  onProcess("uncaughtException", (err) => {
    if (handlingFatal) return; // 二重処理防止
    handlingFatal = true;
    const error = err instanceof Error ? err : new Error(String(err));
    log.error({ message: error.message, stack: error.stack }, "捕捉されない例外(致命的)");
    void Promise.resolve(options.onFatal?.(error))
      .catch(() => { /* 後始末の失敗は無視して終了へ */ })
      .finally(() => { if (exitOnUncaught) exit(1); });
  });
}
