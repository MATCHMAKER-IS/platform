/**
 * `@platform/search` — 全文検索の共通部品(Adapter パターン)。
 *
 * 検索エンジンを意識せず「索引に入れる / 検索する / 消す」を扱える。
 * 本番は Meilisearch(日本語トークナイズ良好)、テスト・小規模はメモリ実装。
 * 失敗は Result で返す。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** 索引に入れるドキュメント(id 必須、他は任意フィールド)。 */
export interface SearchDocument {
  id: string;
  [field: string]: unknown;
}

/** 検索結果 1 件。 */
export interface SearchHit<T extends SearchDocument = SearchDocument> {
  document: T;
  /** 関連スコア(高いほど一致)。 */
  score?: number;
}

/** 検索エンジンの抽象(Adapter)。 */
export interface SearchAdapter {
  index(documents: SearchDocument[]): Promise<void>;
  search(query: string, limit: number): Promise<SearchHit[]>;
  delete(ids: string[]): Promise<void>;
}

/** アプリが使う検索口。 */
export interface Search<T extends SearchDocument = SearchDocument> {
  /** ドキュメントを索引に追加/更新する。 */
  index(documents: T[]): Promise<Result<void>>;
  /** 全文検索する。 */
  search(query: string, limit?: number): Promise<Result<SearchHit<T>[]>>;
  /** ドキュメントを索引から削除する。 */
  delete(ids: string[]): Promise<Result<void>>;
}

function searchError(cause: unknown, msg: string): AppError {
  return new AppError(ErrorCode.EXTERNAL, msg, { cause });
}

/**
 * Adapter を注入して Search を作る。
 * @typeParam T ドキュメント型
 * @param adapter {@link createMeilisearchAdapter} / {@link createMemorySearch}
 * @returns {@link Search}
 *
 * @example
 * ```ts
 * const search = createSearch(createMemorySearch());
 * await search.index([{ id: "1", title: "請求書の書き方", body: "..." }]);
 * const res = await search.search("請求書");
 * ```
 */
export function createSearch<T extends SearchDocument = SearchDocument>(
  adapter: SearchAdapter,
): Search<T> {
  return {
    async index(documents) {
      const r = await tryCatch(() => adapter.index(documents));
      return r.ok ? { ok: true, value: undefined } : { ok: false, error: searchError(r.error.cause ?? r.error, "索引の更新に失敗しました") };
    },
    async search(query, limit = 20) {
      const r = await tryCatch(() => adapter.search(query, limit));
      return r.ok ? { ok: true, value: r.value as SearchHit<T>[] } : { ok: false, error: searchError(r.error.cause ?? r.error, "検索に失敗しました") };
    },
    async delete(ids) {
      const r = await tryCatch(() => adapter.delete(ids));
      return r.ok ? { ok: true, value: undefined } : { ok: false, error: searchError(r.error.cause ?? r.error, "索引の削除に失敗しました") };
    },
  };
}

export { createMemorySearch } from "./adapters/memory.js";
export { createMeilisearchAdapter, type MeilisearchConfig } from "./adapters/meilisearch.js";
export { createBm25Index, type Bm25Index, type Bm25Options, type FieldBoosts } from "./bm25.js";
export { tokenize } from "./tokenize.js";
