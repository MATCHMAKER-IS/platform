/**
 * 一括画像処理の補助。並行数を絞って順序を保ったまま処理する(純粋な並行制御)。
 * 大量・非同期はジョブキュー(@platform/jobs)と組み合わせる。
 * @packageDocumentation
 */

/**
 * items を最大 concurrency 並行で処理し、入力順の結果配列を返す。
 * @example
 * ```ts
 * const results = await mapWithConcurrency(files, (f) => processor.normalizeUpload(f), 4);
 * ```
 *
 * @param items 処理する項目
 * @param fn 処理する関数
 * @param concurrency 並列数(**無制限にしない**。画像処理はメモリを食う)
 * @param onProgress 各完了時に呼ばれる(任意)
 * @returns 結果の配列(**入力と同じ順序**)
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 4,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

/**
 * 進捗つきで並行処理する。
 *
 * **画像処理は重い**(1 枚数秒)。100 枚を無言で待たせず、進捗を見せる。
 * **並列数を制限する**のも重要(無制限だとメモリを食い尽くす)。
 *
 * @param items 処理する項目
 * @param fn 処理する関数
 * @param options.concurrency 並列数
 * @param options.onProgress 各完了時に呼ばれる
 * @returns 結果の配列(**入力と同じ順序**)
 */
export async function runBatch<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  options: { concurrency?: number; onProgress?: (progress: { done: number; total: number; percent: number }) => void } = {},
): Promise<R[]> {
  const { concurrency = 4, onProgress } = options;
  const results = new Array<R>(items.length);
  const total = items.length;
  let next = 0;
  let done = 0;
  async function worker(): Promise<void> {
    while (next < total) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
      done++;
      onProgress?.({ done, total, percent: total === 0 ? 100 : Math.round((done / total) * 100) });
    }
  }
  const n = Math.max(1, Math.min(concurrency, total || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
