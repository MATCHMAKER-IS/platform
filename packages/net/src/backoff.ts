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

/** 試行回数(0 始まり)に対する遅延(ms)を計算する。 */
export function backoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = 100, maxMs = 10_000, factor = 2, jitter = 0 } = options;
  const raw = Math.min(maxMs, baseMs * Math.pow(factor, attempt));
  if (jitter <= 0) return Math.round(raw);
  const delta = raw * jitter;
  return Math.round(raw - delta + Math.random() * delta * 2);
}

/** Promise にタイムアウトを付ける(超過で reject)。 */
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

/** 非同期処理を指数バックオフでリトライする。全失敗なら最後のエラーを throw。 */
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
