/**
 * ライブ更新用の有界バッファ(純関数)。末尾に追加し、最大件数を超えた分は先頭から捨てる。
 * チャートの差分更新で「直近 N 点だけ保持」に使う。
 * @packageDocumentation
 */

/** arr に item を追加し、最大 max 件に丸めた新配列を返す。 */
export function appendCapped<T>(arr: T[], item: T, max: number): T[] {
  const next = arr.length >= max ? arr.slice(arr.length - max + 1) : arr.slice();
  next.push(item);
  return next;
}

/** arr に複数 items を追加し、最大 max 件に丸める。 */
export function appendManyCapped<T>(arr: T[], items: T[], max: number): T[] {
  const merged = arr.concat(items);
  return merged.length > max ? merged.slice(merged.length - max) : merged;
}
