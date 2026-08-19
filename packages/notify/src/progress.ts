/**
 * 進捗マイルストーン判定(純関数)。一括処理の進捗を一定間隔で通知するのに使う。
 * @packageDocumentation
 */

/**
 * prevDone→done で新たに跨いだマイルストーン(%)を返す。
 * @example
 * ```ts
 * // 8件中 done が進むたびに 25/50/75/100% で通知
 * let prev = 0;
 * onProgress = ({ done, total }) => {
 *   for (const m of crossedMilestones(prev, done, total, 25)) notifier.notify({ text: `処理 ${m}% 完了` });
 *   prev = done;
 * };
 * ```
 *
 * @param prevDone 前回までの完了数
 * @param done 今回の完了数
 * @param total 全体の数
 * @param step 何割ごとに知らせるか（**細かすぎると通知が煩わしくなります**）
 * @returns 今回またいだ節目(**節目だけ通知する**。1% ごとに通知すると鬱陶しい)
 */
export function crossedMilestones(prevDone: number, done: number, total: number, step = 25): number[] {
  if (total <= 0 || step <= 0) return [];
  const pct = (n: number) => Math.floor((n / total) * 100);
  const before = pct(prevDone);
  const after = pct(done);
  const out: number[] = [];
  for (let m = step; m <= 100; m += step) {
    if (before < m && after >= m) out.push(m);
  }
  return out;
}
