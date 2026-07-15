/**
 * 関数ユーティリティ。debounce/throttle/memoize/once と関数合成(pipe/compose)。
 * @packageDocumentation
 */

/** 連続呼び出しを最後の1回にまとめる(入力確定を待つ用途)。 */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): ((...args: A) => void) & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; fn(...args); }, waitMs);
  };
  debounced.cancel = () => { if (timer) { clearTimeout(timer); timer = undefined; } };
  return debounced;
}

/** 一定間隔に1回だけ実行する(先頭で即実行し、以降は間隔内を無視)。 */
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

/** 引数をキーに結果をキャッシュする。 */
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

/** 最初の1回だけ実行し、以降は最初の結果を返す。 */
export function once<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let called = false;
  let result: R;
  return (...args: A): R => {
    if (!called) { called = true; result = fn(...args); }
    return result;
  };
}

/** 左から右へ関数を適用する(pipe(f,g)(x) === g(f(x)))。 */
export function pipe<T>(...fns: ((value: T) => T)[]): (value: T) => T {
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value);
}

/** 右から左へ関数を適用する(compose(f,g)(x) === f(g(x)))。 */
export function compose<T>(...fns: ((value: T) => T)[]): (value: T) => T {
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value);
}
