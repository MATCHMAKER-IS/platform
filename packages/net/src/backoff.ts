/**
 * リトライ・指数バックオフ・タイムアウト(純 + 非同期)。
 * @packageDocumentation
 */

/** バックオフ設定。 */
export interface BackoffOptions {
  /** 初期遅延(ms・既定 100)。 */
  baseMs?: number;
  /** 最大遅延(ms・既定 10000)。 */
  maxMs?: number;
  /** 倍率(既定 2)。 */
  factor?: number;
  /** ジッタ(0〜1・既定 0=なし)。乱数で delay を ±jitter 割合ゆらす。 */
  jitter?: number;
}

/**
 * 試行回数に対する遅延を計算する(指数バックオフ)。
 *
 * **ジッター(ゆらぎ)を入れる**のが要点。同時に落ちた 100 台が同じ間隔で再試行すると、
 * 復旧した瞬間に再び倒れる(サンダリングハード)。
 *
 * @param attempt 試行回数(**0 始まり**)
 * @param options.baseMs 基準の遅延
 * @param options.maxMs 上限(青天井にしない)
 * @param options.jitter ゆらぎを入れるか(既定 true)
 * @returns 遅延(ミリ秒)
 */
export function backoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = 100, maxMs = 10_000, factor = 2, jitter = 0 } = options;
  const raw = Math.min(maxMs, baseMs * Math.pow(factor, attempt));
  if (jitter <= 0) return Math.round(raw);
  const delta = raw * jitter;
  return Math.round(raw - delta + Math.random() * delta * 2);
}

/**
 * Promise にタイムアウトを付ける。
 *
 * **タイムアウトしても元の処理は止まらない**(Promise はキャンセルできない)。
 *
 * @param promise 対象の Promise
 * @param ms タイムアウト(ミリ秒)
 * @returns 元の結果
 * @throws タイムアウトした場合
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = "タイムアウトしました"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** リトライ設定。 */
export interface RetryOptions extends BackoffOptions {
  /** 最大リトライ回数(既定 3)。 */
  retries?: number;
  /** リトライ対象か判定(既定: 常に true)。 */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** 各リトライ前のフック。 */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * 非同期処理を指数バックオフで再試行する。
 *
 * **再試行してよいエラーか判断すること**(`shouldRetry`)。認証エラーを再試行しても無駄で、
 * かえってアカウントをロックする。
 *
 * @param fn 実行する処理
 * @param options.attempts 最大試行回数
 * @param options.shouldRetry 再試行するか判定する関数
 * @returns 成功した結果
 * @throws **全部失敗したら最後のエラー**
 */
export async function retry<T>(fn: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, shouldRetry = () => true, onRetry } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastError = e;
      if (attempt === retries || !shouldRetry(e, attempt)) break;
      const delay = backoffDelay(attempt, options);
      onRetry?.(e, attempt, delay);
      await sleep(delay);
    }
  }
  throw lastError;
}
