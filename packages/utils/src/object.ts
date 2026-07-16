/**
 * オブジェクトユーティリティ。pick/omit/deep 系/mapValues 等。
 * @packageDocumentation
 */

/**
 * 指定したキーだけを抜き出す。
 *
 * **API のレスポンスから不要な項目を落とす**のに使う(内部 ID やパスワードハッシュを
 * 誤って返さないよう、明示的に選ぶ)。
 *
 * @param obj 対象のオブジェクト
 * @param keys 残すキー
 * @returns 指定キーだけの新しいオブジェクト
 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

/**
 * 指定したキーを除いたコピーを返す。
 *
 * **{@link pick} の方が安全**(除外を書き忘れると漏れるが、選択なら明示したものしか出ない)。
 * omit は「ほとんど返すが 1〜2 個だけ隠す」ときに。
 *
 * @param obj 対象のオブジェクト
 * @param keys 除くキー
 * @returns 除いた新しいオブジェクト
 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const set = new Set(keys as (keyof T)[]);
  const out = {} as Omit<T, K>;
  for (const k of Object.keys(obj) as (keyof T)[]) if (!set.has(k)) (out as Record<string, unknown>)[k as string] = obj[k];
  return out;
}

/**
 * 値だけを変換した新しいオブジェクトを返す(キーはそのまま)。
 *
 * @param obj 対象のオブジェクト
 * @param fn 値を変換する関数
 * @returns 変換後のオブジェクト
 */
export function mapValues<T extends object, R>(obj: T, fn: (value: T[keyof T], key: keyof T) => R): Record<keyof T, R> {
  const out = {} as Record<keyof T, R>;
  for (const k of Object.keys(obj) as (keyof T)[]) out[k] = fn(obj[k], k);
  return out;
}

/**
 * キーと値を入れ替える。
 *
 * @param obj 対象のオブジェクト(値は文字列か数値)
 * @returns 入れ替えたオブジェクト。**同じ値が複数あれば後勝ち**(キーは重複できないため)
 */
export function invert<T extends Record<string, string | number>>(obj: T): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(obj)) out[String(obj[k])] = k;
  return out;
}

/**
 * 深いコピーを作る(プレーンオブジェクト・配列・日付)。
 *
 * **扱えるのは上記だけ**。Map / Set / 関数 / クラスのインスタンス / 循環参照は
 * 正しくコピーされない。それらが必要なら `structuredClone`(Node 17+)を使う。
 *
 * @param value コピーする値
 * @returns 深いコピー
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => deepClone(v)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as object)) out[k] = deepClone((value as Record<string, unknown>)[k]);
  return out as T;
}

/**
 * 深い等価を判定する。
 *
 * **扱えるのはプレーンオブジェクト・配列・日付・プリミティブだけ**
 * ({@link deepClone} と同じ制限)。
 *
 * @param a 比較する値
 * @param b 比較する値
 * @returns 中身が同じなら true
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * 深いマージを行う(source が dest を上書き)。
 *
 * **配列は連結せず置換する**。「既定の設定に、指定された分だけ上書き」という用途を想定
 * (配列を連結すると、既定値を消せなくなる)。
 *
 * @param dest 土台(既定値)
 * @param source 上書きする値
 * @returns マージした新しいオブジェクト(**元は変更しない**)
 */
export function deepMerge<T extends object>(dest: T, source: Partial<T>): T {
  const out: Record<string, unknown> = { ...(dest as Record<string, unknown>) };
  for (const k of Object.keys(source)) {
    const sv = (source as Record<string, unknown>)[k];
    const dv = out[k];
    if (isPlainObject(dv) && isPlainObject(sv)) out[k] = deepMerge(dv, sv as object);
    else out[k] = sv;
  }
  return out as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/**
 * 値が空かを判定する。
 *
 * `null` / `undefined` / 空文字 / 空配列 / 空オブジェクトを「空」とみなす。
 * **`0` と `false` は空ではない**(値として意味があるため)。
 *
 * @param value 判定する値
 * @returns 空なら true
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" || Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}
