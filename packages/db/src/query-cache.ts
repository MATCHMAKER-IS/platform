/**
 * クエリ結果キャッシュ。`@platform/cache` を用いて、重い読み取りクエリの結果を
 * TTL 付きでキャッシュする。タグによるグループ無効化にも対応する。
 * @packageDocumentation
 */
import type { Cache } from "@platform/cache";
import type { Result } from "@platform/core";

/**
 * キャッシュミス時のみ loader を実行して結果をキャッシュする(定番パターン)。
 * @example
 * ```ts
 * const res = await cachedQuery(cache, "users:active", 60, () => db.user.findMany({ where: { active: true } }));
 * ```
 *
 * @param cache キャッシュ
 * @param key キー
 * @param fn 取得する処理
 * @returns 結果(**キャッシュがあればそれを返す**)
 */
export function cachedQuery<T>(cache: Cache, key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<Result<T>> {
  return cache.getOrSet(key, ttlSeconds, loader);
}

/**
 * キャッシュを無効化する(キー指定)。
 *
 *
 * @param cache キャッシュ
 * @param key 無効化するキー
 * @returns なし(**更新の後に必ず呼ぶ**。呼び忘れると古いデータが返り続ける)
 */
export function invalidateQuery(cache: Cache, key: string): Promise<Result<void>> {
  return cache.delete(key);
}

/** {@link createQueryCache} のオプション。 */
export interface QueryCacheOptions {
  /** キー接頭辞(既定 "q")。 */
  prefix?: string;
  /** 既定 TTL 秒(既定 60)。 */
  defaultTtlSec?: number;
}

/** タグ付きキャッシュ操作。 */
export interface QueryCache {
  /** キャッシュ経由で取得(タグ指定でグループ無効化の対象にできる)。 */
  cached<T>(key: string, loader: () => Promise<T>, options?: { ttlSec?: number; tags?: string[] }): Promise<Result<T>>;
  /** タグに属するキャッシュをまとめて無効化する(バージョン繰り上げ方式)。 */
  invalidateTag(tag: string): Promise<Result<void>>;
}

/**
 * タグ対応のクエリキャッシュを作る。
 * タグのバージョンをキーに織り込み、`invalidateTag` でバージョンを繰り上げることで、
 * ストアの一覧走査なしにグループ無効化を実現する(古いキーは TTL で自然消滅)。
 *
 * @example
 * ```ts
 * const qc = createQueryCache(cache);
 * await qc.cached("orders:page1", () => db.order.findMany(...), { tags: ["orders"], ttlSec: 120 });
 * await qc.invalidateTag("orders"); // orders タグの全キャッシュを無効化
 * ```
 *
 * @param options.ttlMs 保持時間
 * @param options.maxSize 最大件数(**上限が無いとメモリを食い尽くす**)
 * @returns キャッシュ
 */
export function createQueryCache(cache: Cache, options: QueryCacheOptions = {}): QueryCache {
  const prefix = options.prefix ?? "q";
  const defaultTtl = options.defaultTtlSec ?? 60;
  const tagVerKey = (tag: string) => `${prefix}:tagver:${tag}`;

  async function tagVersion(tag: string): Promise<number> {
    const r = await cache.get<number>(tagVerKey(tag));
    return r.ok && typeof r.value === "number" ? r.value : 0;
  }

  return {
    async cached(key, loader, opts = {}) {
      let suffix = "";
      for (const tag of opts.tags ?? []) suffix += `:${tag}@${await tagVersion(tag)}`;
      return cache.getOrSet(`${prefix}:${key}${suffix}`, opts.ttlSec ?? defaultTtl, loader);
    },
    async invalidateTag(tag) {
      const next = (await tagVersion(tag)) + 1;
      return cache.set(tagVerKey(tag), next, 0); // TTL 0 = 無期限でバージョンを保持
    },
  };
}
