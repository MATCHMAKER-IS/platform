/**
 * 配列ユーティリティ。sortBy/partition/keyBy/zip/range/集合演算 等。
 * (chunk/groupBy/uniqueBy は numbers/strings 側に既存)
 * @packageDocumentation
 */

/**
 * キー抽出関数で安定ソートした新しい配列を返す(数値・文字列・日付に対応)。
 *
 * @param array 対象の配列
 * @param keyOf 並べ替えの基準を取り出す関数
 * @param order 昇順/降順(既定 asc)
 * @returns 並べ替えた**新しい配列**(元は変更しない)。**安定ソート**なので同じ値の順序は保たれる
 */
export function sortBy<T>(array: T[], keyOf: (item: T) => number | string | Date, order: "asc" | "desc" = "asc"): T[] {
  const dir = order === "asc" ? 1 : -1;
  return array
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ka = keyOf(a.item);
      const kb = keyOf(b.item);
      const va = ka instanceof Date ? ka.getTime() : ka;
      const vb = kb instanceof Date ? kb.getTime() : kb;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return a.index - b.index; // 安定ソート: 同値なら元の順序
    })
    .map((x) => x.item);
}

/**
 * 述語で [満たす, 満たさない] に二分する。
 *
 * @param array 対象の配列
 * @param predicate 条件
 * @returns `[満たすもの, 満たさないもの]` の 2 つの配列
 */
export function partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  for (const item of array) (predicate(item) ? pass : fail).push(item);
  return [pass, fail];
}

/**
 * キーでインデックス化する(重複キーは後勝ち)。
 *
 * @param array 対象の配列
 * @param keyOf 分類のキーを取り出す関数
 * @returns キー → 要素の辞書。**同じキーは後勝ち**
 */
export function keyBy<T, K extends string | number>(array: T[], keyOf: (item: T) => K): Record<K, T> {
  const out = {} as Record<K, T>;
  for (const item of array) out[keyOf(item)] = item;
  return out;
}

/**
 * 述語ごとの件数を数える。
 *
 * @param array 対象の配列
 * @param keyOf 分類のキーを取り出す関数
 * @returns キー → 件数の辞書
 */
export function countBy<T, K extends string | number>(array: T[], keyOf: (item: T) => K): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const item of array) { const k = keyOf(item); out[k] = (out[k] ?? 0) + 1; }
  return out;
}

/**
 * 複数配列を要素ごとに束ねる(短い方に合わせる)。
 *
 * @param arrays 束ねる配列(可変長)
 */
export function zip<T extends unknown[][]>(...arrays: T): { [K in keyof T]: T[K] extends (infer U)[] ? U : never }[] {
  const len = Math.min(...arrays.map((a) => a.length));
  const out: unknown[] = [];
  for (let i = 0; i < len; i++) out.push(arrays.map((a) => a[i]));
  return out as never;
}

/**
 * 数値範囲を生成する(end は含まない)。range(1,5)=[1,2,3,4]。
 *
 * @param start 開始(含む)
 * @param end 終了(**含まない**)
 * @param step 刻み(既定 1)
 * @returns 連番の配列(end は含まない)
 */
export function range(start: number, end?: number, step = 1): number[] {
  const [from, to] = end === undefined ? [0, start] : [start, end];
  const out: number[] = [];
  if (step === 0) return out;
  if (step > 0) for (let i = from; i < to; i += step) out.push(i);
  else for (let i = from; i > to; i += step) out.push(i);
  return out;
}

/**
 * a にあって b に無い要素(集合差)。
 *
 * @param a 基準の配列
 * @param b 取り除く要素
 * @returns a のうち b に無いもの
 */
export function difference<T>(a: T[], b: T[]): T[] {
  const set = new Set(b);
  return a.filter((x) => !set.has(x));
}

/**
 * a と b の両方にある要素(積集合)。
 *
 * @param a 配列 1
 * @param b 配列 2
 * @returns 両方にあるもの(重複は除く)
 */
export function intersection<T>(a: T[], b: T[]): T[] {
  const set = new Set(b);
  return a.filter((x) => set.has(x));
}

/**
 * falsy(null/undefined/false/0/""/NaN)を除去する。
 *
 * @param array 対象の配列
 * @returns null / undefined を除いた新しい配列
 */
export function compact<T>(array: (T | null | undefined | false | 0 | "")[]): T[] {
  return array.filter(Boolean) as T[];
}

/**
 * 1段フラット化。
 *
 * @param array 入れ子の配列
 * @returns 1 段階だけ平らにした配列
 */
export function flatten<T>(array: (T | T[])[]): T[] {
  return array.reduce<T[]>((acc, v) => acc.concat(v), []);
}

/**
 * 先頭要素(空なら undefined)。
 *
 * @param array 対象の配列
 * @returns 最初の要素。**空なら undefined**
 */
export function first<T>(array: T[]): T | undefined { return array[0]; }
/**
 * 末尾要素(空なら undefined)。
 *
 * @param array 対象の配列
 * @returns 最後の要素。**空なら undefined**
 */
export function last<T>(array: T[]): T | undefined { return array[array.length - 1]; }
