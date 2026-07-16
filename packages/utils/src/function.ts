/**
 * 関数ユーティリティ。debounce/throttle/memoize/once と関数合成(pipe/compose)。
 * @packageDocumentation
 */

/**
 * 連続呼び出しを最後の 1 回にまとめる。
 *
 * **入力が止まるのを待つ**用途。検索ボックスで 1 文字ごとに API を叩かないようにする。
 *
 * {@link throttle} との違い: debounce は「静かになってから 1 回」、
 * throttle は「一定間隔で定期的に」。**入力補完は debounce、スクロール追従は throttle**。
 *
 * @param fn 実行する関数
 * @param waitMs 待つ時間(ミリ秒)。**この時間内に再度呼ばれると先延ばしになる**
 * @returns ラップした関数(`cancel()` で予約を取り消せる)
 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): ((...args: A) => void) & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; fn(...args); }, waitMs);
  };
  debounced.cancel = () => { if (timer) { clearTimeout(timer); timer = undefined; } };
  return debounced;
}

/**
 * 一定間隔に 1 回だけ実行する。
 *
 * **先頭で即実行**し、以降は間隔内の呼び出しを無視する。
 * スクロール・リサイズなど「連続するが、定期的に反応したい」用途。
 *
 * @param fn 実行する関数
 * @param intervalMs 間隔(ミリ秒)
 * @returns ラップした関数
 */
export function throttle<A extends unknown[]>(fn: (...args: A) => void, intervalMs: number): (...args: A) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    const now = Date.now();
    const remaining = intervalMs - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      // 末尾の1回を保証(間隔終了時に最後の引数で実行)
      timer = setTimeout(() => { last = Date.now(); timer = undefined; fn(...args); }, remaining);
    }
  };
}

/**
 * 引数をキーに結果をキャッシュする。
 *
 * **同じ引数なら計算し直さない**。重い計算に使う。
 *
 * 注意: **キャッシュは無限に増える**(上限が無い)。引数の種類が多いなら
 * `@platform/cache`(LRU・TTL つき)を使うこと。
 *
 * @param fn キャッシュしたい関数
 * @param keyOf 引数からキーを作る関数(既定は `JSON.stringify`)
 * @returns ラップした関数
 */
export function memoize<A extends unknown[], R>(fn: (...args: A) => R, keyOf: (...args: A) => string = (...a) => JSON.stringify(a)): ((...args: A) => R) & { clear(): void } {
  const cache = new Map<string, R>();
  const memoized = (...args: A): R => {
    const key = keyOf(...args);
    if (cache.has(key)) return cache.get(key)!;
    const value = fn(...args);
    cache.set(key, value);
    return value;
  };
  memoized.clear = () => cache.clear();
  return memoized;
}

/**
 * 最初の 1 回だけ実行し、以降は最初の結果を返す。
 *
 * 初期化処理に使う(**何度呼ばれても 1 回しか走らない**)。
 *
 * @param fn 実行する関数
 * @returns ラップした関数
 */
export function once<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let called = false;
  let result: R;
  return (...args: A): R => {
    if (!called) { called = true; result = fn(...args); }
    return result;
  };
}

/**
 * 左から右へ関数を適用する。
 *
 * **読む順に書ける**ので、こちらの方が直感的なことが多い。
 *
 * @param fns 適用する関数(左から順に)
 * @returns 合成した関数
 *
 * @example
 * ```ts
 * pipe(trim, toLowerCase)("  ABC  ");  // => "abc"(trim してから小文字)
 * ```
 */
export function pipe<T>(...fns: ((value: T) => T)[]): (value: T) => T {
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value);
}

/**
 * 右から左へ関数を適用する(数学の関数合成と同じ向き)。
 *
 * `compose(f, g)(x)` は `f(g(x))`。**{@link pipe} と逆**なので注意。
 *
 * @param fns 適用する関数(右から順に)
 * @returns 合成した関数
 */
export function compose<T>(...fns: ((value: T) => T)[]): (value: T) => T {
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value);
}
