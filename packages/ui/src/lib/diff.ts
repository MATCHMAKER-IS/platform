/**
 * 行データの差分(追加・変更・削除・不変)。CSV/貼付取り込みのプレビューに使う。
 * @packageDocumentation
 */

/** 変更行の詳細。 */
export interface ChangedRow<T> { key: string; before: T; after: T; fields: string[] }

/** 差分結果。 */
export interface RowDiff<T> {
  added: T[];
  removed: T[];
  changed: ChangedRow<T>[];
  unchanged: T[];
}

function changedFields<T extends Record<string, unknown>>(a: T, b: T): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => String(a[k] ?? "") !== String(b[k] ?? ""));
}

/** current と incoming を keyOf で突き合わせ、追加/変更/削除/不変に分類する。 */
export function diffRecords<T extends Record<string, unknown>>(
  current: T[], incoming: T[], keyOf: (r: T) => string,
): RowDiff<T> {
  const curMap = new Map(current.map((r) => [keyOf(r), r]));
  const inMap = new Map(incoming.map((r) => [keyOf(r), r]));
  const added: T[] = [];
  const changed: ChangedRow<T>[] = [];
  const unchanged: T[] = [];
  for (const [k, after] of inMap) {
    const before = curMap.get(k);
    if (!before) { added.push(after); continue; }
    const fields = changedFields(before, after);
    if (fields.length) changed.push({ key: k, before, after, fields });
    else unchanged.push(after);
  }
  const removed = current.filter((r) => !inMap.has(keyOf(r)));
  return { added, removed, changed, unchanged };
}
