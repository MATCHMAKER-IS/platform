/**
 * 一覧表示のクライアント側クエリ(検索フィルタ・ソート・ページング)を行う純関数。
 * 大量データはサーバ側 `repository.paginate` を使い、これは取得済み行の絞り込みに使う。
 * @packageDocumentation
 */

/** テーブルクエリ条件。 */
export interface TableQuery {
  search?: string;
  /** 検索対象のキー。 */
  searchKeys?: string[];
  sortKey?: string;
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

/** クエリ結果。 */
export interface TableResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}

/** 行配列に検索・ソート・ページングを適用する。 */
export function queryRows<T extends Record<string, unknown>>(rows: T[], q: TableQuery = {}): TableResult<T> {
  let out = rows;
  if (q.search && q.searchKeys?.length) {
    const s = q.search.toLowerCase();
    out = out.filter((r) => q.searchKeys!.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
  }
  if (q.sortKey) {
    const k = q.sortKey;
    const dir = q.sortDir === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      const av = a[k], bv = b[k];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv), "ja") * dir;
    });
  }
  const total = out.length;
  const pageSize = q.pageSize ?? 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, q.page ?? 1), pageCount);
  const start = (page - 1) * pageSize;
  return { rows: out.slice(start, start + pageSize), total, page, pageCount };
}

// ─────────────── 一覧の選択状態(複数選択・一括操作) ───────────────

/** 選択状態(選択された行キーの集合)。 */
export type Selection = ReadonlySet<string>;

/** 空の選択状態。 */
export function emptySelection(): Selection {
  return new Set<string>();
}

/** 1 行の選択をトグルする。 */
export function toggleRow(selection: Selection, key: string): Selection {
  const next = new Set(selection);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** 指定キーが選択されているか。 */
export function isRowSelected(selection: Selection, key: string): boolean {
  return selection.has(key);
}

/** 表示中の全行が選択されているか(全選択チェックボックスの状態)。 */
export function isAllSelected(selection: Selection, keys: string[]): boolean {
  return keys.length > 0 && keys.every((k) => selection.has(k));
}

/** 一部だけ選択されているか(全選択チェックボックスの中間状態 indeterminate)。 */
export function isIndeterminate(selection: Selection, keys: string[]): boolean {
  const some = keys.some((k) => selection.has(k));
  return some && !isAllSelected(selection, keys);
}

/** 表示中の全行を選択/解除する(全選択チェックボックス)。 */
export function toggleAll(selection: Selection, keys: string[]): Selection {
  if (isAllSelected(selection, keys)) {
    const next = new Set(selection);
    for (const k of keys) next.delete(k);
    return next;
  }
  const next = new Set(selection);
  for (const k of keys) next.add(k);
  return next;
}

/** 選択件数。 */
export function selectionCount(selection: Selection): number {
  return selection.size;
}

/** 選択されたキーの配列。 */
export function selectedKeys(selection: Selection): string[] {
  return [...selection];
}
