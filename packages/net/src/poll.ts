/**
 * ロングポーリング(条件が満たされるまで一定間隔で問い合わせる)。
 * @packageDocumentation
 */

/** {@link poll} のオプション。 */
export interface PollOptions<T> {
  /** 各試行の間隔(ms・既定 1000)。 */
  intervalMs?: number;
  /** 全体のタイムアウト(ms・既定 30000)。 */
  timeoutMs?: number;
  /** 終了条件(true を返したら resolve)。既定: 値が truthy。 */
  until?: (value: T) => boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 条件が満たされるまで繰り返し確認する。
 *
 * **非同期な処理の完了を待つ**のに使う(バッチの終了、外部システムの反映)。
 * ただし**ポーリングは最後の手段**。webhook やイベントで通知できるなら、そちらが良い。
 *
 * @param fn 確認する処理
 * @param options.intervalMs 確認の間隔
 * @param options.timeoutMs 諦めるまでの時間
 * @returns 条件を満たした結果
 * @throws タイムアウトした場合
 */
export async function poll<T>(fn: (attempt: number) => Promise<T>, options: PollOptions<T> = {}): Promise<T> {
  const { intervalMs = 1000, timeoutMs = 30_000, until = (v) => Boolean(v) } = options;
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  for (;;) {
    const value = await fn(attempt);
    if (until(value)) return value;
    attempt++;
    if (Date.now() + intervalMs > deadline) throw new Error("ポーリングがタイムアウトしました");
    await sleep(intervalMs);
  }
}
