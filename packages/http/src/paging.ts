/**
 * ページングの共通規約。
 *
 * 一覧 API では必ず必要になるが、**各 API が個別に実装すると必ずずれる**:
 *
 *   - `page` が 0 始まりの API と 1 始まりの API が混在する
 *   - 上限を決めていない API に `limit=100000` が来て落ちる
 *   - 総件数を返す API と返さない API があり、画面が作り分けを強いられる
 *
 * 【2 つの方式】
 *
 * | | オフセット方式 | カーソル方式 |
 * |---|---|---|
 * | 使う場面 | **画面にページ番号を出す** | 無限スクロール・大量データ |
 * | 総件数 | 出せる | **出せない**（数えると重い） |
 * | 弱点 | **深いページが遅い**（10 万件目を数える） | 途中のページへ飛べない |
 * | ずれ | **追加・削除で行が飛ぶ/重複する** | ずれない |
 *
 * **件数が増える見込みがあるならカーソル方式**にする。
 * オフセット方式は 1 万件を超えたあたりから目に見えて遅くなり、
 * その頃には画面もクエリも作り込まれていて直しにくい。
 *
 * @packageDocumentation
 */

/** ページングの上限（**これ以上は受け付けない**）。 */
export const MAX_LIMIT = 200;

/** 既定の 1 ページあたりの件数。 */
export const DEFAULT_LIMIT = 20;

/** オフセット方式の指定。 */
export interface OffsetPaging {
  /** ページ番号（**1 始まり**）。 */
  page: number;
  /** 1 ページあたりの件数。 */
  limit: number;
  /** SQL の OFFSET に渡す値。 */
  offset: number;
}

/** カーソル方式の指定。 */
export interface CursorPaging {
  /** 続きを取る位置（**前回の最後の行の識別子**）。最初は未指定。 */
  cursor?: string;
  /** 取る件数。 */
  limit: number;
}

/**
 * クエリ文字列からオフセット方式の指定を作る。
 *
 * **不正な値でエラーにしない**。`page=abc` や `limit=-1` が来ても、
 * 既定値に丸めて動かす。一覧が見えないより、既定で見える方がよい。
 *
 * ただし**上限は必ず守る**。`limit=100000` を通すと、
 * 1 回の要求でサーバの記憶域を食い尽くされる。
 *
 * @param params クエリ（`URLSearchParams` または素のオブジェクト）
 * @param options.defaultLimit 既定の件数
 * @param options.maxLimit 上限（既定 200）
 * @returns ページ番号・件数・オフセット
 *
 * @example
 * ```ts
 * const paging = parseOffsetPaging(new URL(req.url).searchParams);
 * const rows = await db.item.findMany({ skip: paging.offset, take: paging.limit });
 * ```
 */
export function parseOffsetPaging(
  params: URLSearchParams | Record<string, string | undefined>,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): OffsetPaging {
  const get = (k: string): string | undefined =>
    params instanceof URLSearchParams ? (params.get(k) ?? undefined) : params[k];

  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIMIT;

  // **不正な値は既定に丸める**（エラーにしない）
  const rawPage = Number(get("page"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawLimit = Number(get("limit") ?? get("perPage"));
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1
    // **上限は必ず守る**。大きい値を通すと記憶域を食い尽くされる
    ? Math.min(Math.floor(rawLimit), maxLimit)
    : defaultLimit;

  return { page, limit, offset: (page - 1) * limit };
}

/**
 * クエリ文字列からカーソル方式の指定を作る。
 *
 * @param params クエリ
 * @param options.defaultLimit 既定の件数
 * @param options.maxLimit 上限（既定 200）
 * @returns カーソルと件数
 *
 * @example
 * ```ts
 * const { cursor, limit } = parseCursorPaging(new URL(req.url).searchParams);
 * const rows = await db.item.findMany({
 *   take: limit + 1,                                   // **1 件多く取る**（次があるか判定）
 *   ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
 * });
 * ```
 */
export function parseCursorPaging(
  params: URLSearchParams | Record<string, string | undefined>,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): CursorPaging {
  const get = (k: string): string | undefined =>
    params instanceof URLSearchParams ? (params.get(k) ?? undefined) : params[k];

  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const rawLimit = Number(get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1
    ? Math.min(Math.floor(rawLimit), maxLimit)
    : (options.defaultLimit ?? DEFAULT_LIMIT);

  const cursor = get("cursor");
  return cursor !== undefined && cursor !== "" ? { cursor, limit } : { limit };
}

/** オフセット方式の応答。 */
export interface OffsetPage<T> {
  /** その頁の行。 */
  items: T[];
  /** ページ番号（1 始まり）。 */
  page: number;
  /** 1 ページあたりの件数。 */
  limit: number;
  /** 総件数。 */
  total: number;
  /** 総ページ数。 */
  totalPages: number;
  /** 次の頁があるか。 */
  hasNext: boolean;
  /** 前の頁があるか。 */
  hasPrev: boolean;
}

/**
 * オフセット方式の応答を組み立てる。
 *
 * **形を揃える**のが目的。API ごとに `total` があったり無かったりすると、
 * 画面側が API ごとに作り分けることになる。
 *
 * @param items その頁の行
 * @param total 総件数
 * @param paging {@link parseOffsetPaging} の結果
 * @returns 画面がそのまま使える形
 *
 * @example
 * ```ts
 * const [items, total] = await Promise.all([
 *   db.item.findMany({ skip: paging.offset, take: paging.limit }),
 *   db.item.count(),
 * ]);
 * return Response.json(buildOffsetPage(items, total, paging));
 * ```
 */
export function buildOffsetPage<T>(
  items: readonly T[],
  total: number,
  paging: OffsetPaging,
): OffsetPage<T> {
  const totalPages = paging.limit > 0 ? Math.ceil(total / paging.limit) : 0;
  return {
    items: [...items],
    page: paging.page,
    limit: paging.limit,
    total,
    totalPages,
    hasNext: paging.page < totalPages,
    hasPrev: paging.page > 1,
  };
}

/** カーソル方式の応答。 */
export interface CursorPage<T> {
  /** 取れた行。 */
  items: T[];
  /** **次を取るためのカーソル**。無ければ末尾。 */
  nextCursor?: string;
  /** 次があるか。 */
  hasNext: boolean;
}

/**
 * カーソル方式の応答を組み立てる。
 *
 * **`limit + 1` 件取ってから渡す**。1 件多く取れたかどうかで
 * 「次があるか」が分かる（総件数を数えなくて済む）。
 *
 * @param rows 取得した行（**`limit + 1` 件取る**）
 * @param limit 1 回に返す件数
 * @param getCursor 行からカーソルを取り出す関数
 * @returns 次のカーソル付きの応答
 *
 * @example
 * ```ts
 * const rows = await db.item.findMany({ take: limit + 1, orderBy: { id: "asc" } });
 * return Response.json(buildCursorPage(rows, limit, (r) => r.id));
 * ```
 */
export function buildCursorPage<T>(
  rows: readonly T[],
  limit: number,
  getCursor: (row: T) => string,
): CursorPage<T> {
  // **1 件多く取れていれば次がある**
  const hasNext = rows.length > limit;
  const items = hasNext ? rows.slice(0, limit) : [...rows];
  const last = items[items.length - 1];
  return {
    items,
    ...(hasNext && last !== undefined ? { nextCursor: getCursor(last) } : {}),
    hasNext,
  };
}

/** 並び順の指定。 */
export interface SortSpec {
  /** 並べる項目。 */
  field: string;
  /** 昇順か降順か。 */
  direction: "asc" | "desc";
}

/**
 * クエリ文字列から並び順を作る。
 *
 * **許可した項目だけを受け付ける**。クエリの値をそのまま
 * `ORDER BY` に渡すと、索引の無い列で全表走査になったり、
 * SQL インジェクションの入口になったりする。
 *
 * @param params クエリ（`sort=-createdAt` の形。先頭の `-` が降順）
 * @param allowed 許可する項目名
 * @param fallback 指定が無い・不正なときの既定
 * @returns 並び順
 *
 * @example
 * ```ts
 * // **許可リストに無い項目は無視される**
 * const sort = parseSort(searchParams, ["createdAt", "name"], { field: "createdAt", direction: "desc" });
 * const rows = await db.item.findMany({ orderBy: { [sort.field]: sort.direction } });
 * ```
 */
export function parseSort(
  params: URLSearchParams | Record<string, string | undefined>,
  allowed: readonly string[],
  fallback: SortSpec,
): SortSpec {
  const get = (k: string): string | undefined =>
    params instanceof URLSearchParams ? (params.get(k) ?? undefined) : params[k];

  const raw = get("sort");
  if (raw === undefined || raw === "") return fallback;

  const desc = raw.startsWith("-");
  const field = desc ? raw.slice(1) : raw;

  // **許可リストに無ければ既定に戻す**（クエリの値を信用しない）
  if (!allowed.includes(field)) return fallback;
  return { field, direction: desc ? "desc" : "asc" };
}

/**
 * ページングのリンクヘッダを組み立てる（RFC 8288）。
 *
 * API を機械が使うとき、**次の頁の URL を自分で組み立てさせない**。
 * クエリの付け方を間違えて 1 頁目を繰り返す事故が起きる。
 *
 * @param baseUrl 現在の URL
 * @param page {@link buildOffsetPage} の結果
 * @returns `Link` ヘッダの値。**頁が 1 つしか無ければ空文字**
 *
 * @example
 * ```ts
 * const link = buildLinkHeader(req.url, page);
 * return Response.json(page, { headers: link ? { Link: link } : {} });
 * ```
 */
export function buildLinkHeader<T>(baseUrl: string, page: OffsetPage<T>): string {
  if (page.totalPages <= 1) return "";

  const make = (p: number): string => {
    const u = new URL(baseUrl);
    u.searchParams.set("page", String(p));
    u.searchParams.set("limit", String(page.limit));
    return u.toString();
  };

  const parts: string[] = [];
  if (page.hasPrev) {
    parts.push(`<${make(1)}>; rel="first"`);
    parts.push(`<${make(page.page - 1)}>; rel="prev"`);
  }
  if (page.hasNext) {
    parts.push(`<${make(page.page + 1)}>; rel="next"`);
    parts.push(`<${make(page.totalPages)}>; rel="last"`);
  }
  return parts.join(", ");
}
