/**
 * `@platform/cache` — キャッシュの共通部品(Adapter パターン)。
 *
 * 保存先(メモリ / Redis)を意識せず使える。開発・小規模はメモリ、
 * 本番・複数インスタンスは Redis に差し替える。失敗は Result で返し、
 * キャッシュ障害がアプリ本体を巻き込まないようにする。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** キャッシュ保存先の抽象(Adapter)。 */
export interface CacheAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

/** アプリが使うキャッシュ口。値は JSON として出し入れする。 */
export interface Cache {
  /** 値を取得する(未ヒットは `ok` かつ `null`)。 */
  get<T>(key: string): Promise<Result<T | null>>;
  /** 値を保存する(TTL 秒を指定可能)。 */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<Result<void>>;
  /** 値を削除する。 */
  delete(key: string): Promise<Result<void>>;
  /**
   * 未ヒット時に `loader` で生成してキャッシュする定番パターン。
   * @param key キャッシュキー
   * @param ttlSeconds TTL 秒
   * @param loader 値の生成関数(キャッシュミス時のみ実行)
   */
  getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<Result<T>>;
  /**
   * stale-while-revalidate。TTL 内は即返し、`staleSeconds` の猶予中は古い値を返しつつ
   * 裏で再取得する。レイテンシを抑えつつ鮮度を保つ。
   */
  getOrSetSwr<T>(key: string, opts: { freshSeconds: number; staleSeconds: number }, loader: () => Promise<T>): Promise<Result<T>>;
}

/** SWR 用のエンベロープ(保存時刻を内包)。 */
interface SwrEnvelope<T> { v: T; at: number }

function cacheError(cause: unknown, msg: string): AppError {
  return new AppError(ErrorCode.EXTERNAL, msg, { cause });
}

/**
 * Adapter を注入して Cache を作る。
 * @param adapter 保存先({@link createMemoryCache} / {@link createRedisCache})
 * @returns {@link Cache}
 *
 * @example
 * ```ts
 * const cache = createCache(createMemoryCache());
 * const res = await cache.getOrSet("users:list", 60, () => fetchUsers());
 * ```
 */
export function createCache(adapter: CacheAdapter, now: () => number = () => Date.now()): Cache {
  // 同一キーの同時 loader を1本化(キャッシュスタンピード防止)
  const inflight = new Map<string, Promise<Result<unknown>>>();
  const api: Cache = {
    async get<T>(key: string) {
      const r = await tryCatch(() => adapter.get(key));
      if (!r.ok) return { ok: false, error: cacheError(r.error.cause ?? r.error, "キャッシュ取得に失敗しました") };
      return { ok: true, value: r.value === null ? null : (JSON.parse(r.value) as T) };
    },
    async set<T>(key: string, value: T, ttlSeconds?: number) {
      const r = await tryCatch(() => adapter.set(key, JSON.stringify(value), ttlSeconds));
      return r.ok ? r : { ok: false, error: cacheError(r.error.cause ?? r.error, "キャッシュ保存に失敗しました") };
    },
    async delete(key: string) {
      const r = await tryCatch(() => adapter.delete(key));
      return r.ok ? r : { ok: false, error: cacheError(r.error.cause ?? r.error, "キャッシュ削除に失敗しました") };
    },
    async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>) {
      const hit = await api.get<T>(key);
      if (hit.ok && hit.value !== null) return { ok: true, value: hit.value };
      // 進行中の loader があれば相乗り(N 個の同時ミスでも loader は1回)
      const existing = inflight.get(key);
      if (existing) return (await existing) as Result<T>;
      const task = (async (): Promise<Result<unknown>> => {
        const loaded = await tryCatch(loader);
        if (!loaded.ok) return loaded;
        await api.set(key, loaded.value, ttlSeconds);
        return { ok: true, value: loaded.value };
      })().finally(() => inflight.delete(key));
      inflight.set(key, task);
      return (await task) as Result<T>;
    },
    async getOrSetSwr<T>(key: string, opts: { freshSeconds: number; staleSeconds: number }, loader: () => Promise<T>) {
      const wrapped = await api.get<SwrEnvelope<T>>(key);
      const total = opts.freshSeconds + opts.staleSeconds;
      const refresh = async (): Promise<Result<T>> => {
        const existing = inflight.get(key);
        if (existing) return (await existing) as Result<T>;
        const task = (async (): Promise<Result<unknown>> => {
          const loaded = await tryCatch(loader);
          if (!loaded.ok) return loaded;
          await api.set<SwrEnvelope<T>>(key, { v: loaded.value, at: now() }, total);
          return { ok: true, value: loaded.value };
        })().finally(() => inflight.delete(key));
        inflight.set(key, task);
        return (await task) as Result<T>;
      };
      if (wrapped.ok && wrapped.value !== null) {
        const ageSec = (now() - wrapped.value.at) / 1000;
        if (ageSec <= opts.freshSeconds) return { ok: true, value: wrapped.value.v };
        // stale: 古い値を即返しつつ裏で更新(結果は待たない)
        void refresh();
        return { ok: true, value: wrapped.value.v };
      }
      return refresh();
    },
  };
  return api;
}

export { createMemoryCache } from "./adapters/memory.js";
export { createRedisCache, type RedisCacheConfig, type RedisCacheClient } from "./adapters/redis.js";
