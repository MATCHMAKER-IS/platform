/**
 * サーキットブレーカー（連鎖障害を防ぐ）。
 *
 * 外部サービスが落ちているのに呼び続けると、**自分まで巻き込まれて落ちる**。
 * 1 回の呼び出しがタイムアウトまで数秒かかると、待ちが積み上がって
 * スレッドや接続が枯渇し、**無関係な機能まで応答しなくなる**。
 *
 * 「相手が落ちているなら、しばらく呼ばない」で自分を守るのがこの部品。
 *
 * 【`createBulkhead` との違い】
 *   - **Bulkhead** … 同時に走る数を制限する（**遅い相手**から守る）
 *   - **CircuitBreaker** … 失敗が続いたら呼ぶのをやめる（**落ちた相手**から守る）
 *
 * 両方を組み合わせると、外部連携の事故がアプリ全体へ広がらない。
 *
 * 【3 つの状態】
 * ```
 *   closed ──失敗が閾値を超える──> open ──一定時間後──> half-open
 *     ^                                                    │
 *     └──────────成功が続いた──────────────────────┘
 *                          （失敗したら open に戻る）
 * ```
 *   - **closed** … 通常。呼び出しを通す
 *   - **open** … 遮断中。**呼ばずに即座に失敗**を返す（相手も自分も休める）
 *   - **half-open** … 様子見。**少数だけ通して**回復したか確かめる
 *
 * 【half-open が要る理由】
 * open から直接 closed に戻すと、まだ回復していない相手へ一斉に流れ込み、
 * **再び落とす**（回復しかけたところを潰す）。少数で試してから戻す。
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "./error";

/** ブレーカーの状態。 */
export type CircuitState = "closed" | "open" | "half-open";

/** ブレーカーの設定。 */
export interface CircuitBreakerOptions {
  /**
   * 遮断する失敗回数（連続）。
   *
   * 小さすぎると一時的な失敗で遮断してしまい、大きすぎると守れない。
   * **5 回程度**から始めて、実際の失敗率を見て調整する。
   */
  failureThreshold: number;
  /**
   * 遮断を続ける時間（ミリ秒）。
   *
   * 相手が回復する見込みの時間。**短すぎると回復前に叩いて再び落とす**。
   * 30 秒〜1 分が目安。
   */
  resetTimeoutMs: number;
  /**
   * half-open で通す数。
   *
   * **1 が基本**。多く流すと、回復しかけた相手を再び落とす。
   */
  halfOpenMaxCalls?: number;
  /**
   * half-open から closed に戻すのに必要な連続成功数。
   *
   * 既定は `halfOpenMaxCalls` と同じ（通した分がすべて成功したら戻す）。
   */
  successThreshold?: number;
  /**
   * この失敗は数えない、と判定する関数。
   *
   * **相手のせいでない失敗を数えない**ために使う。
   * 入力が不正（400）で失敗したのに遮断すると、正しい要求まで通らなくなる。
   */
  isFailure?: (error: unknown) => boolean;
  /** 時刻の取得（テスト注入用）。 */
  now?: () => number;
  /** 状態が変わったときに呼ばれる（**ログや通知に使う**）。 */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

/** ブレーカーの現在の様子。 */
export interface CircuitStats {
  /** 現在の状態。 */
  state: CircuitState;
  /** 連続失敗回数。 */
  consecutiveFailures: number;
  /** 累計の呼び出し数。 */
  totalCalls: number;
  /** 累計の失敗数。 */
  totalFailures: number;
  /** **遮断して呼ばずに弾いた数**。 */
  rejectedCalls: number;
  /** 次に half-open へ移る時刻（open のときのみ）。 */
  openUntil?: number;
}

/** サーキットブレーカー。 */
export interface CircuitBreaker {
  /**
   * 関数を実行する。
   *
   * **open のときは実行せずに例外を投げる**（相手を呼ばない）。
   */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  /** 現在の様子。 */
  stats(): CircuitStats;
  /** 手動で閉じる（**復旧を確認したときに使う**）。 */
  reset(): void;
  /** 手動で開く（**相手のメンテナンス中など、呼びたくないときに使う**）。 */
  trip(): void;
}

/**
 * サーキットブレーカーを作る。
 *
 * **外部サービスごとに 1 つ作る**。まとめると、A が落ちたときに B への
 * 呼び出しまで止まってしまう。
 *
 * @param options 設定
 * @returns ブレーカー
 * @throws {@link AppError} コード `EXTERNAL` — open のときに `execute` を呼んだ場合
 *
 * @example
 * ```ts
 * // 決済サービス用のブレーカー（他のサービスとは分ける）
 * const breaker = createCircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeoutMs: 30_000,
 *   // **入力エラー(400 番台)は数えない**。相手が落ちたわけではない
 *   isFailure: (e) => !(e instanceof AppError && e.code === ErrorCode.VALIDATION),
 *   onStateChange: (from, to) => logger.warn(`決済ブレーカー: ${from} → ${to}`),
 * });
 *
 * const result = await breaker.execute(() => payment.charge(order));
 * ```
 */
export function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  const failureThreshold = Math.max(1, options.failureThreshold);
  const resetTimeoutMs = Math.max(0, options.resetTimeoutMs);
  const halfOpenMaxCalls = Math.max(1, options.halfOpenMaxCalls ?? 1);
  const successThreshold = Math.max(1, options.successThreshold ?? halfOpenMaxCalls);
  const isFailure = options.isFailure ?? (() => true);
  const now = options.now ?? (() => Date.now());

  let state: CircuitState = "closed";
  let consecutiveFailures = 0;
  let totalCalls = 0;
  let totalFailures = 0;
  let rejectedCalls = 0;
  let openUntil = 0;
  /** half-open で今走っている数。 */
  let halfOpenInFlight = 0;
  /** half-open で連続して成功した数。 */
  let halfOpenSuccesses = 0;

  function transition(to: CircuitState): void {
    if (state === to) return;
    const from = state;
    state = to;
    if (to === "open") {
      openUntil = now() + resetTimeoutMs;
      halfOpenInFlight = 0;
      halfOpenSuccesses = 0;
    }
    if (to === "closed") {
      consecutiveFailures = 0;
      halfOpenInFlight = 0;
      halfOpenSuccesses = 0;
    }
    if (to === "half-open") {
      halfOpenInFlight = 0;
      halfOpenSuccesses = 0;
    }
    options.onStateChange?.(from, to);
  }

  /** open の時間が過ぎていれば half-open にする。 */
  function maybeHalfOpen(): void {
    if (state === "open" && now() >= openUntil) transition("half-open");
  }

  function onSuccess(): void {
    if (state === "half-open") {
      halfOpenSuccesses += 1;
      // **通した分がすべて成功したら閉じる**
      if (halfOpenSuccesses >= successThreshold) transition("closed");
      return;
    }
    consecutiveFailures = 0;
  }

  function onFailure(): void {
    totalFailures += 1;
    consecutiveFailures += 1;
    // **half-open で失敗したら即座に open へ戻す**（まだ回復していない）
    if (state === "half-open") {
      transition("open");
      return;
    }
    if (consecutiveFailures >= failureThreshold) transition("open");
  }

  return {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      maybeHalfOpen();

      if (state === "open") {
        rejectedCalls += 1;
        // **相手を呼ばずに即座に失敗を返す**。これが目的
        throw new AppError(
          ErrorCode.EXTERNAL,
          "接続先が繰り返し失敗しているため、一時的に呼び出しを止めています",
          { details: { retryAfterMs: Math.max(0, openUntil - now()) } },
        );
      }

      if (state === "half-open") {
        // **様子見の間は少数しか通さない**。一斉に流すと回復しかけた相手を再び落とす
        if (halfOpenInFlight >= halfOpenMaxCalls) {
          rejectedCalls += 1;
          throw new AppError(
            ErrorCode.EXTERNAL,
            "接続先の回復を確認中です。しばらく待ってからやり直してください",
          );
        }
        halfOpenInFlight += 1;
      }

      totalCalls += 1;
      try {
        const result = await fn();
        onSuccess();
        return result;
      } catch (e) {
        // **相手のせいでない失敗は数えない**（入力エラーで遮断すると、正しい要求まで通らない）
        if (isFailure(e)) onFailure();
        else if (state === "half-open") halfOpenSuccesses += 1;
        throw e;
      } finally {
        if (state === "half-open" && halfOpenInFlight > 0) halfOpenInFlight -= 1;
      }
    },

    stats(): CircuitStats {
      maybeHalfOpen();
      return {
        state,
        consecutiveFailures,
        totalCalls,
        totalFailures,
        rejectedCalls,
        ...(state === "open" ? { openUntil } : {}),
      };
    },

    reset(): void {
      transition("closed");
    },

    trip(): void {
      transition("open");
    },
  };
}
