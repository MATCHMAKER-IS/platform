/**
 * 検索インデックスの永続化。横断検索の対象ドキュメントを保存し、書き込み時に更新する（都度全件収集を避ける）。
 * 検索自体は @platform/search（BM25）で保存済みドキュメントに対して行う。
 * @packageDocumentation
 */
import { createSearch, createMemorySearch, type SearchHit } from "@platform/search";
import { type EntityDoc } from "./entity-search";

/** 検索インデックスストア。 */
export interface SearchIndexStore {
  upsert(docs: EntityDoc[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  all(): Promise<EntityDoc[]>;
  clear(): Promise<void>;
}

/** インメモリ実装。 */
export function createMemorySearchIndexStore(): SearchIndexStore {
  const map = new Map<string, EntityDoc>();
  return {
    async upsert(docs) {
      for (const d of docs) map.set(d.id, d);
    },
    async remove(ids) {
      for (const id of ids) map.delete(id);
    },
    async all() {
      return [...map.values()];
    },
    async clear() {
      map.clear();
    },
  };
}

/** 保存済みドキュメントに対して全文検索する。 */
export async function searchIndexed(store: SearchIndexStore, query: string, limit = 20): Promise<SearchHit<EntityDoc>[]> {
  const docs = await store.all();
  const search = createSearch<EntityDoc>(createMemorySearch());
  const indexed = await search.index(docs);
  if (!indexed.ok) return [];
  const res = await search.search(query, limit);
  return res.ok ? res.value : [];
}

// ── Prisma 実装 ──

/** SearchDocRow の必要部分。 */
export interface SearchDocRow {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
  text: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface SearchIndexStoreDb {
  searchDocRow: {
    findMany(args?: Record<string, never>): Promise<SearchDocRow[]>;
    upsert(args: { where: { id: string }; create: SearchDocRow; update: Omit<SearchDocRow, "id"> }): Promise<SearchDocRow>;
    deleteMany(args?: { where?: { id: { in: string[] } } }): Promise<{ count: number }>;
  };
}

const rowToDoc = (r: SearchDocRow): EntityDoc => ({ id: r.id, type: r.type as EntityDoc["type"], title: r.title, subtitle: r.subtitle, href: r.href, text: r.text });

/** Prisma 実装。 */
export function createPrismaSearchIndexStore(db: SearchIndexStoreDb): SearchIndexStore {
  return {
    async upsert(docs) {
      for (const d of docs) {
        const { id, ...rest } = d;
        await db.searchDocRow.upsert({ where: { id }, create: d, update: rest });
      }
    },
    async remove(ids) {
      if (ids.length > 0) await db.searchDocRow.deleteMany({ where: { id: { in: ids } } });
    },
    async all() {
      return (await db.searchDocRow.findMany()).map(rowToDoc);
    },
    async clear() {
      await db.searchDocRow.deleteMany();
    },
  };
}
