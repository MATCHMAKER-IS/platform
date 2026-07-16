/**
 * メモリ検索 Adapter。BM25 転置インデックス(日本語 CJK バイグラム対応)でスコアリングする。
 * 外部エンジン無しで実用的な全文検索を提供(小〜中規模データ・テスト・オフライン向け)。
 * @packageDocumentation
 */
import type { SearchAdapter, SearchDocument, SearchHit } from "../index";
import { createBm25Index, type Bm25Options } from "../bm25";

/**
 * メモリ検索 Adapter を作る。
 * @param options BM25 パラメータ・フィールド重み(任意)
 * @returns {@link SearchAdapter} 実装
 */
export function createMemorySearch(options: Bm25Options = {}): SearchAdapter {
  const index = createBm25Index(options);
  return {
    async index(documents) {
      index.addAll(documents as ({ id: string } & Record<string, unknown>)[]);
    },
    async search(query, limit) {
      return index.search(query, limit).map<SearchHit>((r) => ({ document: r.doc as SearchDocument, score: r.score }));
    },
    async delete(ids) {
      for (const id of ids) index.remove(id);
    },
  };
}
