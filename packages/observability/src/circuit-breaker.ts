/**
 * サーキットブレーカー。連続失敗で「開」にして即座に失敗させ、一定時間後に「半開」で試験的に通す。
 * 外部依存(Zoho/決済 API 等)の障害伝播を止め、回復を待つ。依存ゼロ。
 * @packageDocumentation
 */

/** 状態。closed=通常 / open=遮断中 / half_open=試験中。 */
export type CircuitState = "closed" | "open" | "half_open";

/** ブレーカー設定。 */
export interface CircuitBreakerOptions {
  /** 「開」にする連続失敗しきい値(既定 5)。 */
  failureThreshold?: number;
  /** 「開」からこの時間(ms)経過で「半開」に(既定 30000)。 */
  resetTimeoutMs?: number;
  /** 「半開」で連続何回成功したら「閉」に戻すか(既定 1)。 */
  successThreshold?: number;
  /** 現在時刻(テスト差替用)。 */
  now?: () => number;
}

/** 遮断中に投げられるエラー。 */
export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) { super(`サーキットが開いています(${retryAfterMs}ms 後に再試行可能)`); this.retryAfterMs = retryAfterMs; }
}

/** サーキットブレーカー。 */
export interface CircuitBreaker {
  /** 関数を保護実行する。開いている間は即座に CircuitOpenError。 */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  /** 現在の状態。 */
  state(): CircuitState;
  /** 統計。 */
  stats(): { state: CircuitState; failures: number; successes: number; openedAt?: number };
  /** 手動リセット(閉に戻す)。 */
  reset(): void;
}

/** サーキットブレーカーを作る。 */
export function createCircuitBreaker(options: CircuitBreakerOptions = {}): CircuitBreaker {
  const failureThreshold = options.failureThreshold ?? 5;
  const resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
  const successThreshold = options.successThreshold ?? 1;
  const now = options.now ?? (() => Date.now());

  let state: CircuitState = "closed";
  let failures = 0;
  let successes = 0;
  let openedAt: number | undefined;

  function toOpen() { state = "open"; openedAt = now(); successes = 0; }
  function toClosed() { state = "closed"; failures = 0; successes = 0; openedAt = undefined; }
  function toHalfOpen() { state = "half_open"; successes = 0; failures = 0; }

  function onSuccess() {
    if (state === "half_open") {
      successes += 1;
      if (successes >= successThreshold) toClosed();
    } else {
      failures = 0;
    }
  }
  function onFailure() {
    if (state === "half_open") { toOpen(); return; }
    failures += 1;
    if (failures >= failureThreshold) toOpen();
  }

  return {
    async execute(fn) {
      if (state === "open") {
        const elapsed = now() - (openedAt ?? 0);
        if (elapsed >= resetTimeoutMs) toHalfOpen();
        else throw new CircuitOpenError(resetTimeoutMs - elapsed);
      }
      try {
        const result = await fn();
        onSuccess();
        return result;
      } catch (e) {
        onFailure();
        throw e;
      }
    },
    state: () => state,
    stats: () => ({ state, failures, successes, openedAt }),
    reset: toClosed,
  };
}
