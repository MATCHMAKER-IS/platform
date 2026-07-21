/**
 * クライアント側の無操作タイマー(純ロジック・DOM 非依存)。
 * 一定時間無操作で `onIdle`(自動ログアウト)、その手前で `onWarn`(警告表示)を発火する。
 * スケジューラ・時刻は注入可能でテストしやすい。DOM への配線は {@link bindActivityListeners}。
 * @packageDocumentation
 */

/** {@link createIdleTimer} の設定。 */
export interface IdleTimerConfig {
  /** 無操作からログアウトまでのミリ秒。 */
  timeoutMs: number;
  /** ログアウトの何ミリ秒前に警告するか(既定 0 = 警告なし)。 */
  warnBeforeMs?: number;
  /** 警告発火時(残り時間 ms を渡す)。 */
  onWarn?: (remainingMs: number) => void;
  /** 無操作タイムアウト到達時(=ログアウト実行)。 */
  onIdle: () => void;
  /** 警告中に活動が戻ったとき(警告を消す用)。 */
  onActive?: () => void;
  /** setTimeout/clearTimeout の注入(テスト用)。 */
  scheduler?: { set: (fn: () => void, ms: number) => unknown; clear: (h: unknown) => void };
  now?: () => number;
}

/** 無操作タイマー。 */
export interface IdleTimer {
  /** タイマー開始(初回のログイン直後などに呼ぶ)。 */
  start(): void;
  /** 活動を記録してタイマーをリセットする(操作イベントごとに呼ぶ)。 */
  activity(): void;
  /** 停止(ログアウト時・アンマウント時)。 */
  stop(): void;
}

/**
 * 無操作タイマーを作る(自動ログアウト用)。
 *
 * **席を離れたまま放置されたセッションを閉じる**。共用 PC で他人に操作される事故を防ぐ。
 *
 * @param options.timeoutMs 無操作がこの時間続いたら発火
 * @param options.onIdle 発火したときの処理(ログアウトなど)
 * @param options.onWarn 発火前の警告(任意。「あと 1 分で切れます」)
 * @returns タイマー。`touch` で操作があったことを伝える
 */
export function createIdleTimer(config: IdleTimerConfig): IdleTimer {
  const warnBeforeMs = config.warnBeforeMs ?? 0;
  const sched = config.scheduler ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };
  let warnHandle: unknown = null;
  let idleHandle: unknown = null;
  let warned = false;
  let running = false;

  function clearTimers() {
    if (warnHandle !== null) { sched.clear(warnHandle); warnHandle = null; }
    if (idleHandle !== null) { sched.clear(idleHandle); idleHandle = null; }
  }

  function schedule() {
    clearTimers();
    if (warnBeforeMs > 0 && warnBeforeMs < config.timeoutMs) {
      warnHandle = sched.set(() => { warned = true; config.onWarn?.(config.timeoutMs - (config.timeoutMs - warnBeforeMs)); }, config.timeoutMs - warnBeforeMs);
    }
    idleHandle = sched.set(() => { running = false; clearTimers(); config.onIdle(); }, config.timeoutMs);
  }

  return {
    start() { running = true; warned = false; schedule(); },
    activity() {
      if (!running) return;
      if (warned) { warned = false; config.onActive?.(); }
      schedule();
    },
    stop() { running = false; warned = false; clearTimers(); },
  };
}

/** ブラウザで監視する活動イベント。 */
export const IDLE_ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "visibilitychange"] as const;

/**
 * 操作イベントを購読できる対象。
 *
 * @remarks
 * **`Window` 型を使わない。** `@platform/session` の tsconfig は `lib: ["ES2022"]` で
 * DOM を含まないため、`Window` を書くと **型検査が通らない**(TS2304)。
 * 必要な形だけを宣言すれば、ブラウザでも Node でもテストの偽物でも渡せる。
 */
export interface ActivityTarget {
  addEventListener: (type: string, handler: () => void, options?: unknown) => void;
  removeEventListener: (type: string, handler: () => void, options?: unknown) => void;
}

/**
 * DOM の活動イベントをタイマーに配線する(ブラウザ専用)。返り値で解除できる。
 * @example
 * ```ts
 * const timer = createIdleTimer({ timeoutMs: 15*60_000, warnBeforeMs: 60_000, onWarn, onIdle: logout });
 * timer.start();
 * const unbind = bindActivityListeners(timer);
 * // クリーンアップ: unbind(); timer.stop();
 * ```
 *
 * @param timer 無操作タイマー
 * @param target イベントを購読する対象(既定はブラウザの window)
 * @returns 購読を解除する関数。**画面を離れるときに必ず呼ぶ**(呼ばないとリークする)
 */
export function bindActivityListeners(timer: IdleTimer, target: ActivityTarget = globalThis as unknown as ActivityTarget): () => void {
  const handler = () => timer.activity();
  for (const ev of IDLE_ACTIVITY_EVENTS) target.addEventListener(ev, handler, { passive: true });
  return () => { for (const ev of IDLE_ACTIVITY_EVENTS) target.removeEventListener(ev, handler); };
}
