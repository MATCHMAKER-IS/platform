/**
 * Meilisearch Adapter。日本語トークナイズが標準で良好。
 * meilisearch クライアントをここだけで import する。
 * @packageDocumentation
 */
import { MeiliSearch } from "meilisearch";
import type { SearchAdapter, SearchDocument, SearchHit } from "../index.js";

/** Meilisearch 接続設定。 */
export interface MeilisearchConfig {
  host: string;
  apiKey: string;
  /** 使用するインデックス名。 */
  indexName: string;
}

/**
 * Meilisearch Adapter を作る。
 * @param config 接続設定
 * @returns {@link SearchAdapter} 実装
 */
export function createMeilisearchAdapter(config: MeilisearchConfig): SearchAdapter {
  const client = new MeiliSearch({ host: config.host, apiKey: config.apiKey });
  const index = client.index(config.indexName);
  return {
    async index(documents: SearchDocument[]) {
      await index.addDocuments(documents);
    },
    async search(query: string, limit: number) {
      const res = await index.search(query, { limit });
      return res.hits.map((h) => ({ document: h as SearchDocument })) as SearchHit[];
    },
    async delete(ids: string[]) {
      await index.deleteDocuments(ids);
    },
  };
}
