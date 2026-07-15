/**
 * オブジェクトユーティリティ。pick/omit/deep 系/mapValues 等。
 * @packageDocumentation
 */

/** 指定キーだけ抜き出す。 */
export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}

/** 指定キーを除いたコピー。 */
export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const set = new Set(keys as (keyof T)[]);
  const out = {} as Omit<T, K>;
  for (const k of Object.keys(obj) as (keyof T)[]) if (!set.has(k)) (out as Record<string, unknown>)[k as string] = obj[k];
  return out;
}

/** 値だけを変換した新オブジェクト。 */
export function mapValues<T extends object, R>(obj: T, fn: (value: T[keyof T], key: keyof T) => R): Record<keyof T, R> {
  const out = {} as Record<keyof T, R>;
  for (const k of Object.keys(obj) as (keyof T)[]) out[k] = fn(obj[k], k);
  return out;
}

/** キーと値を入れ替える。 */
export function invert<T extends Record<string, string | number>>(obj: T): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(obj)) out[String(obj[k])] = k;
  return out;
}

/** プレーンオブジェクト/配列/日付を再帰コピーする(構造化複製の軽量版)。 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => deepClone(v)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as object)) out[k] = deepClone((value as Record<string, unknown>)[k]);
  return out as T;
}

/** 深い等価判定(プレーンオブジェクト/配列/日付/プリミティブ)。 */
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

/** 深いマージ(source が dest を上書き。プレーンオブジェクトは再帰、配列/プリミティブは置換)。 */
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

/** 値が空か(null/undefined/空文字/空配列/空オブジェクト)。 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" || Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}
