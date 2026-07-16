/**
 * 非同期ユーティリティ。並行数制限つき map・汎用リトライ・タイムアウト。
 * (core の bulkhead はサービス隔離用。こちらは一括処理の並行制御用)
 * @packageDocumentation
 */

/**
 * 並行数を制限して非同期 map する(順序は保持)。
 * 大量アイテムを外部 API に投げる際、同時実行数を抑えて相手を守る。
 * @param items 対象
 * @param mapper 各要素の非同期処理
 * @param concurrency 同時実行数(既定 5)
 * @returns 入力と**同じ順序**の結果の配列(完了順ではない)
 */
export async function pMapLimit<T, R>(items: T[], mapper: (item: T, index: number) => Promise<R>, concurrency = 5): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** タイムアウト例外。 */
export class TimeoutError extends Error {
  constructor(ms: number) { super(`操作が ${ms}ms でタイムアウトしました`); this.name = "TimeoutError"; }
}

/**
 * Promise にタイムアウトを付ける。
 *
 * **外部 API が返ってこないとき、いつまでも待たない**ため。
 * タイムアウトしても**元の処理は止まらない**(Promise はキャンセルできない)ので、
 * 中断が必要なら AbortSignal を使うこと。
 *
 * @param promise 対象の Promise
 * @param ms タイムアウト(ミリ秒)
 * @param message エラーメッセージ(任意)
 * @returns 元の Promise の結果
 * @throws {@link TimeoutError} — 指定時間を超えた場合
 */
export function pTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}
