/**
 * 検索インデックスの永続化。横断検索の対象ドキュメントを保存し、書き込み時に更新する（都度全件収集を避ける）。
 * 検索自体は @platform/search（BM25）で保存済みドキュメントに対して行う。
 * @packageDocumentation
 */
import { formatNumber } from "@platform/utils";
import { AppError, ErrorCode } from "@platform/core";
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
    // **`take` が型に無かった。** `all()` が上限件数を渡しているのに
    // 型定義は空オブジェクトしか許していなかった(2026-08、同種の
    // パターンを全 route.ts の一括型検査で発見)。
    findMany(args?: { take?: number }): Promise<SearchDocRow[]>;
    // **`upsert` は要求しない。** 1 件ずつ upsert すると、
    // `reindex`(最大 5 万件)で**DB との往復が 5 万回**になる。
    // 「まとめて消して、まとめて入れる」で済むので、
    // **使わないものを型で要求しない**(要求すると、差し替え実装も用意させることになる)
    createMany(args: { data: SearchDocRow[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
    deleteMany(args?: { where?: { id: { in: string[] } } }): Promise<{ count: number }>;
  };
}

const rowToDoc = (r: SearchDocRow): EntityDoc => ({ id: r.id, type: r.type as EntityDoc["type"], title: r.title, subtitle: r.subtitle, href: r.href, text: r.text });

/** Prisma 実装。 */
/**
 * 索引に載せる文書数の上限。
 *
 * **検索のたびに全件を読み込んで索引を作り直す**作りなので、
 * ここが増えるほど 1 回の検索が遅くなる。5 万件は
 * 「請求書・見積・取引先を合わせた数年分」の目安。
 *
 * 【超えたらどうするか】
 * 索引に入れているのは**請求書・取引先・監査ログ**(`/api/admin/reindex`)。
 * **増え続けるのは監査ログだけ**なので、まずそれを外す:
 *
 * 1. `reindex` の対象から監査ログを外す(請求書と取引先だけにする)
 * 2. それでも足りなければ、**DB の全文検索**
 *    (`@platform/db` の `fullTextSearch`)へ移す——**全件を読み込まずに済む**
 *
 * **`reindex` を叩けば索引は入れ替わる**ので、対象を変えるだけで減らせる
 * (監査ログのように「消す手段が無い」状態にはならない)。
 */
const SEARCH_DOC_LIMIT = 50_000;

export function createPrismaSearchIndexStore(db: SearchIndexStoreDb): SearchIndexStore {
  return {
    async upsert(docs) {
      if (docs.length === 0) return;

      // **1 件ずつ upsert しない。**
      // `reindex` は最大 5 万件を渡すので、1 件ずつだと **DB との往復が 5 万回**になる。
      // 1 往復 2ms でも 100 秒、ネットワーク越しならその数倍——
      // **管理画面が固まったように見え、途中で閉じられて中途半端な索引が残る**。
      //
      // **「消してから入れる」に変える。** 索引は**作り直せるもの**なので、
      // 途中で失敗しても `reindex` をもう一度叩けば戻る
      // (元データは請求書・取引先・監査ログ側にある)。
      //
      // **1 件更新のときも同じ道を通る**(請求書を 1 件保存したときなど)。
      // その場合は 2 回の往復で済むので、遅くならない。
      const ids = docs.map((d) => d.id);
      await db.searchDocRow.deleteMany({ where: { id: { in: ids } } });

      // **まとめて入れる。** 一度に送る量が多すぎると DB 側の上限に当たるので、
      // 1,000 件ずつに切る(PostgreSQL のパラメータ上限は 65,535)
      const CHUNK = 1_000;
      for (let i = 0; i < docs.length; i += CHUNK) {
        await db.searchDocRow.createMany({ data: docs.slice(i, i + CHUNK) });
      }
    },
    async remove(ids) {
      if (ids.length > 0) await db.searchDocRow.deleteMany({ where: { id: { in: ids } } });
    },
    async all() {
      // **上限を設ける。** `searchIndexed` は**検索のたびに全件を読み込んで
      // 索引を作り直す**ので、件数が増えると 1 回の検索が重くなる。
      //
      // **黙って切らない**——切ると「検索したのに出てこない」となり、
      // **無いのか漏れたのか分からない**。上限に達したら知らせて、
      // 絞り込みを促す(監査ログの `all()` と同じ判断)。
      const rows = await db.searchDocRow.findMany({ take: SEARCH_DOC_LIMIT + 1 });
      if (rows.length > SEARCH_DOC_LIMIT) {
        throw new AppError(
          ErrorCode.VALIDATION,
          `検索対象が ${formatNumber(SEARCH_DOC_LIMIT)} 件を超えました。種別で絞るか、索引の対象を見直してください`,
          { details: { limit: SEARCH_DOC_LIMIT } },
        );
      }
      return rows.map(rowToDoc);
    },
    async clear() {
      await db.searchDocRow.deleteMany();
    },
  };
}
