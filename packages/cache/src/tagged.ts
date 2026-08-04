/**
 * タグによるキャッシュの無効化。
 *
 * `createCache` はキー単位で消す。だが実務で必要になるのは
 * **「関連するものをまとめて消す」**方が多い:
 *
 *   - 取引先の情報を更新した → その取引先に関する**すべての**キャッシュを消す
 *   - 商品の価格を変えた → 見積・請求・一覧など**どこで使ったか分からない**
 *
 * キーを列挙して消そうとすると、**必ず消し忘れる**。
 * 「どこでキャッシュしたか」を全部覚えている人はいない。
 *
 * 【この実装の考え方：世代番号で無効化する】
 * タグごとに**世代番号**を持ち、キャッシュキーにその番号を混ぜる。
 * 無効化のときは番号を 1 つ進めるだけ。**古い番号のキーは二度と参照されず**、
 * TTL で自然に消える。
 *
 * ```
 *   customer:42 の世代が 3 のとき
 *     → 実際のキー "g3:quote:1001"
 *   無効化すると世代が 4 になる
 *     → 以降は "g4:quote:1001" を見るので、古い値には当たらない
 * ```
 *
 * **キーを列挙しなくてよい**のが要点。何件キャッシュしていても、
 * 消すのは番号を進める 1 回の操作で済む。
 *
 * 【注意】
 * 古い値は**すぐには消えない**（TTL まで残る）。
 * 記憶域を厳密に開けたいなら、キー単位の `delete` を併用する。
 *
 * @packageDocumentation
 */
import { type Result } from "@platform/core";
import type { Cache } from "./index";

/** タグ付きキャッシュ。 */
export interface TaggedCache {
  /**
   * 値を取得する。
   *
   * **タグの世代が進んでいれば未ヒット**になる（古い値には当たらない）。
   */
  get<T>(key: string, tags: readonly string[]): Promise<Result<T | null>>;
  /** 値を保存する（**その時点の世代**で保存される）。 */
  set<T>(key: string, tags: readonly string[], value: T, ttlSeconds?: number): Promise<Result<void>>;
  /** 未ヒット時に生成して保存する。 */
  getOrSet<T>(key: string, tags: readonly string[], ttlSeconds: number, loader: () => Promise<T>): Promise<Result<T>>;
  /**
   * タグに紐づくキャッシュをまとめて無効にする。
   *
   * **キーを列挙しなくてよい**。世代番号を進めるだけなので、
   * 何件キャッシュしていても 1 回の操作で済む。
   */
  invalidate(...tags: readonly string[]): Promise<Result<void>>;
  /** タグの現在の世代（**調査用**。通常は使わない）。 */
  generation(tag: string): Promise<Result<number>>;
}

/** 世代番号を保存するキーの接頭辞。 */
const GENERATION_PREFIX = "__tag_gen__:";

/**
 * 世代番号の保存期間（秒）。
 *
 * **キャッシュ本体の TTL より長くする**。世代番号が先に消えると 0 に戻り、
 * 古い値に当たってしまう。既定は 30 日。
 */
const GENERATION_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * タグ付きキャッシュを作る。
 *
 * 既存の `Cache` を包むので、**Redis でもメモリでもそのまま使える**。
 *
 * @param cache 元になるキャッシュ
 * @param options.generationTtlSeconds 世代番号の保存期間（既定 30 日）
 * @returns タグ付きキャッシュ
 *
 * @example
 * ```ts
 * const tagged = createTaggedCache(cache);
 *
 * // 取引先 42 に関する見積をキャッシュ
 * await tagged.getOrSet("quote:1001", ["customer:42"], 300, () => loadQuote(1001));
 * await tagged.getOrSet("quote:1002", ["customer:42"], 300, () => loadQuote(1002));
 *
 * // 取引先 42 の情報が変わった → **キーを列挙せずにまとめて無効化**
 * await tagged.invalidate("customer:42");
 * ```
 */
export function createTaggedCache(
  cache: Cache,
  options: { generationTtlSeconds?: number } = {},
): TaggedCache {
  const genTtl = options.generationTtlSeconds ?? GENERATION_TTL_SECONDS;

  /** タグの世代を読む（無ければ 0）。 */
  async function readGeneration(tag: string): Promise<Result<number>> {
    const r = await cache.get<number>(`${GENERATION_PREFIX}${tag}`);
    if (!r.ok) return r;
    return { ok: true, value: typeof r.value === "number" ? r.value : 0 };
  }

  /**
   * タグの並びから、実際のキーを組み立てる。
   *
   * **タグは並び順に依存させない**（`["a","b"]` と `["b","a"]` は同じキーになる）。
   * 呼び出し側で順序が揺れても、同じ値を指すようにする。
   */
  async function buildKey(key: string, tags: readonly string[]): Promise<Result<string>> {
    if (tags.length === 0) return { ok: true, value: key };
    const sorted = [...tags].sort();
    const parts: string[] = [];
    for (const t of sorted) {
      const g = await readGeneration(t);
      if (!g.ok) return g;
      parts.push(`${t}=${g.value}`);
    }
    return { ok: true, value: `${parts.join("&")}|${key}` };
  }

  return {
    async get<T>(key: string, tags: readonly string[]): Promise<Result<T | null>> {
      const k = await buildKey(key, tags);
      if (!k.ok) return k;
      return cache.get<T>(k.value);
    },

    async set<T>(key: string, tags: readonly string[], value: T, ttlSeconds?: number): Promise<Result<void>> {
      const k = await buildKey(key, tags);
      if (!k.ok) return k;
      return cache.set(k.value, value, ttlSeconds);
    },

    async getOrSet<T>(
      key: string,
      tags: readonly string[],
      ttlSeconds: number,
      loader: () => Promise<T>,
    ): Promise<Result<T>> {
      const k = await buildKey(key, tags);
      if (!k.ok) return k;
      return cache.getOrSet(k.value, ttlSeconds, loader);
    },

    async invalidate(...tags: readonly string[]): Promise<Result<void>> {
      for (const t of tags) {
        const g = await readGeneration(t);
        if (!g.ok) return g;
        // **世代を 1 つ進めるだけ。** 古い番号のキーは二度と参照されず、TTL で消える
        const r = await cache.set(`${GENERATION_PREFIX}${t}`, g.value + 1, genTtl);
        if (!r.ok) return r;
      }
      return { ok: true, value: undefined };
    },

    generation(tag: string): Promise<Result<number>> {
      return readGeneration(tag);
    },
  };
}

/**
 * よく使うタグ名を組み立てる。
 *
 * **タグ名の付け方を揃える**ための補助。人によって
 * `customer:42` / `customer-42` / `Customer:42` と揺れると、
 * 無効化しても消えない事故が起きる。
 *
 * @param entity 対象の種類（`customer` / `product` など）
 * @param id 識別子
 * @returns タグ名
 *
 * @example
 * ```ts
 * tag("customer", 42);   // → "customer:42"
 * tag("product", "A-1"); // → "product:A-1"
 * ```
 */
export function tag(entity: string, id: string | number): string {
  return `${entity.trim().toLowerCase()}:${String(id).trim()}`;
}
