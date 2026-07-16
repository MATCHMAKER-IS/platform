/**
 * ページング補助。Prisma のモデルデリゲート(findMany/count)に対して、
 * オフセット方式とカーソル方式のページングを共通化する。
 * @packageDocumentation
 */

/** オフセットページングの結果。 */
export interface Paginated<T> {
  items: T[];
  /** 総件数。 */
  total: number;
  /** 現在ページ(1 始まり)。 */
  page: number;
  /** 1 ページの件数。 */
  pageSize: number;
  /** 総ページ数。 */
  pageCount: number;
}

/**
 * ページ番号・件数からメタ情報を計算する(純関数)。
 *
 *
 * @param page ページ番号(1 始まり)
 * @param perPage 1 ページの件数
 * @param total 総件数
 * @returns ページ数・前後の有無
 */
export function buildPageMeta(total: number, page: number, pageSize: number): Omit<Paginated<never>, "items"> {
  const safeSize = Math.max(1, Math.floor(pageSize));
  const safePage = Math.max(1, Math.floor(page));
  return { total, page: safePage, pageSize: safeSize, pageCount: Math.max(1, Math.ceil(total / safeSize)) };
}

/** findMany + count を持つ最小デリゲート。 */
interface CountableDelegate<T> {
  findMany(args: { where?: unknown; orderBy?: unknown; skip: number; take: number }): Promise<T[]>;
  count(args?: { where?: unknown }): Promise<number>;
}

/** {@link paginate} のオプション。 */
export interface PaginateOptions {
  where?: unknown;
  orderBy?: unknown;
  /** 現在ページ(1 始まり、既定 1)。 */
  page?: number;
  /** 1 ページの件数(既定 20)。 */
  pageSize?: number;
}

/**
 * オフセットページング。総件数も返す(件数表示・ページ番号 UI 向き)。
 * @example
 * ```ts
 * const result = await paginate(db.user, { where: { active: true }, page: 2, pageSize: 20 });
 * // { items, total, page, pageSize, pageCount }
 * ```
 *
 * @param model Prisma のモデル
 * @param options.page / perPage / where / orderBy 検索条件
 * @returns 行とページ情報(**COUNT も実行する**ので、件数が多いと重い。無限スクロールならカーソル方式を検討)
 */
export async function paginate<T>(delegate: CountableDelegate<T>, options: PaginateOptions = {}): Promise<Paginated<T>> {
  const { where, orderBy, page = 1, pageSize = 20 } = options;
  const meta = buildPageMeta(0, page, pageSize);
  const [items, total] = await Promise.all([
    delegate.findMany({ where, orderBy, skip: (meta.page - 1) * meta.pageSize, take: meta.pageSize }),
    delegate.count(where ? { where } : undefined),
  ]);
  return { items, ...buildPageMeta(total, page, pageSize) };
}

/** カーソルページングの結果。 */
export interface CursorPage<T> {
  items: T[];
  /** 次ページ取得用カーソル(無ければ null)。 */
  nextCursor: string | number | null;
}

interface CursorDelegate<T> {
  findMany(args: { where?: unknown; orderBy?: unknown; take: number; skip?: number; cursor?: Record<string, unknown> }): Promise<T[]>;
}

/** {@link cursorPaginate} のオプション。 */
export interface CursorPaginateOptions {
  where?: unknown;
  orderBy?: unknown;
  /** 取得件数(既定 20)。 */
  take?: number;
  /** カーソル(前回の nextCursor)。 */
  cursor?: string | number | null;
  /** カーソルに使うフィールド名(既定 "id")。 */
  cursorField?: string;
}

/**
 * カーソルページング。大きなリストの無限スクロール向き(総件数は取らない)。
 * @example
 * ```ts
 * const page1 = await cursorPaginate(db.log, { orderBy: { id: "desc" }, take: 50 });
 * const page2 = await cursorPaginate(db.log, { orderBy: { id: "desc" }, take: 50, cursor: page1.nextCursor });
 * ```
 */
export async function cursorPaginate<T extends Record<string, unknown>>(
  delegate: CursorDelegate<T>,
  options: CursorPaginateOptions = {},
): Promise<CursorPage<T>> {
  const { where, orderBy, take = 20, cursor, cursorField = "id" } = options;
  const items = await delegate.findMany({
    where,
    orderBy,
    take: take + 1, // 次があるか判定するため 1 件多く取る
    ...(cursor != null ? { skip: 1, cursor: { [cursorField]: cursor } } : {}),
  });
  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? (last[cursorField] as string | number) : null;
  return { items: page, nextCursor };
}
