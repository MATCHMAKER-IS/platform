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

/**
 * 行に検索・ソート・ページングを適用する。
 *
 * **順序が重要**(検索 → ソート → ページング)。ページングを先にすると、
 * 「1 ページ目の中だけ検索」になってしまう。
 *
 * @param rows 全行
 * @param options.search 検索語
 * @param options.sort 並べ替え
 * @param options.page ページ番号と件数
 * @returns 表示する行と、**総件数**(ページャに必要)
 */
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

/**
 * 空の選択状態を作る。
 *
 * @returns 何も選択していない状態
 */
export function emptySelection(): Selection {
  return new Set<string>();
}

/**
 * 1 行の選択を切り替える。
 *
 * @param selection 現在の選択
 * @param key 行のキー
 * @returns 更新した**新しい選択**(元は変更しない)
 */
export function toggleRow(selection: Selection, key: string): Selection {
  const next = new Set(selection);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/**
 * その行が選択されているかを判定する。
 *
 * @param selection 選択状態
 * @param key 行のキー
 * @returns 選択されていれば true
 */
export function isRowSelected(selection: Selection, key: string): boolean {
  return selection.has(key);
}

/**
 * 表示中の全行が選択されているかを判定する(全選択チェックボックス用)。
 *
 * **表示中の行だけを見る**(絞り込み中なら、絞り込んだ結果の全選択)。
 *
 * @param selection 選択状態
 * @param visibleKeys 表示中の行のキー
 * @returns すべて選択されていれば true。**表示が 0 件なら false**
 */
export function isAllSelected(selection: Selection, keys: string[]): boolean {
  return keys.length > 0 && keys.every((k) => selection.has(k));
}

/**
 * 一部だけ選択されているかを判定する(チェックボックスの中間状態)。
 *
 * **`indeterminate` を出すため**。全選択でも未選択でもない状態を、
 * チェックボックスの見た目で伝える。
 *
 * @param selection 選択状態
 * @param visibleKeys 表示中の行のキー
 * @returns 一部だけ選択されていれば true
 */
export function isIndeterminate(selection: Selection, keys: string[]): boolean {
  const some = keys.some((k) => selection.has(k));
  return some && !isAllSelected(selection, keys);
}

/**
 * 表示中の全行を選択・解除する。
 *
 * **絞り込み中は、絞り込んだ分だけ**(見えていない行を勝手に選ばない)。
 *
 * @param selection 現在の選択
 * @param visibleKeys 表示中の行のキー
 * @param checked 選択するか
 * @returns 更新した新しい選択
 */
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

/**
 * 選択件数を返す。
 *
 * @param selection 選択状態
 * @returns 件数
 */
export function selectionCount(selection: Selection): number {
  return selection.size;
}

/**
 * 選択されたキーを返す。
 *
 * @param selection 選択状態
 * @returns キーの配列
 */
export function selectedKeys(selection: Selection): string[] {
  return [...selection];
}
