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

/** 条件が満たされるまで fn を繰り返し呼ぶ。タイムアウトで reject。 */
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
