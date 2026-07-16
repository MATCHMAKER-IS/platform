/**
 * クエリパラメータ操作(純ロジック)。
 * URL 全体を保ったままクエリの取得・追加・更新・削除を行う。クエリ文字列の解析/組み立ても。
 * @packageDocumentation
 */

/**
 * クエリ文字列をオブジェクトに解析する。
 *
 * @param query クエリ文字列(先頭の `?` はあってもなくてもよい)
 * @returns キー → 値。**同名キーが複数あれば配列**(`?a=1&a=2` → `{ a: ["1","2"] }`)
 */
export function parseQuery(search: string): Record<string, string | string[]> {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = all.length > 1 ? all : all[0]!;
  }
  return out;
}

/**
 * オブジェクトをクエリ文字列に組み立てる。
 *
 * **キー順にソートする**ので、同じ内容なら常に同じ文字列になる
 * (キャッシュキーや比較に使える)。
 *
 * @param params キー → 値
 * @returns クエリ文字列(**先頭の `?` は付かない**)
 */
export function stringifyQuery(params: Record<string, string | number | boolean | (string | number)[] | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) sp.append(key, String(v));
    else sp.append(key, String(value));
  }
  return sp.toString();
}

/** URL の一部(?以降)を書き換える内部ヘルパ。相対でも動く。 */
function editSearch(url: string, edit: (sp: URLSearchParams) => void): string {
  const hashIndex = url.indexOf("#");
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const noHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const qIndex = noHash.indexOf("?");
  const path = qIndex >= 0 ? noHash.slice(0, qIndex) : noHash;
  const sp = new URLSearchParams(qIndex >= 0 ? noHash.slice(qIndex + 1) : "");
  edit(sp);
  const search = sp.toString();
  return path + (search ? `?${search}` : "") + hash;
}

/**
 * クエリパラメータを取得する。
 *
 * @param url URL
 * @param key キー
 * @returns 値。**複数あれば最初の 1 つ**。無ければ undefined
 */
export function getParam(url: string, key: string): string | null {
  const qIndex = url.indexOf("?");
  if (qIndex < 0) return null;
  const hashIndex = url.indexOf("#");
  const query = hashIndex >= 0 ? url.slice(qIndex + 1, hashIndex) : url.slice(qIndex + 1);
  return new URLSearchParams(query).get(key);
}

/**
 * クエリパラメータを設定する(既存は置き換え)。
 *
 * @param url URL
 * @param key キー
 * @param value 値
 * @returns 新しい URL(**元は変更しない**)
 */
export function setParam(url: string, key: string, value: string | number | boolean): string {
  return editSearch(url, (sp) => sp.set(key, String(value)));
}

/**
 * 複数のクエリパラメータをまとめて設定する。
 *
 * @param url URL
 * @param params キー → 値
 * @returns 新しい URL
 */
export function setParams(url: string, params: Record<string, string | number | boolean | null | undefined>): string {
  return editSearch(url, (sp) => {
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) sp.delete(k);
      else sp.set(k, String(v));
    }
  });
}

/**
 * クエリパラメータを追加する(**同名を残して増やす**)。
 *
 * 置き換えたいなら {@link setQueryParam}。
 *
 * @param url URL
 * @param key キー
 * @param value 値
 * @returns 新しい URL
 */
export function appendParam(url: string, key: string, value: string | number): string {
  return editSearch(url, (sp) => sp.append(key, String(value)));
}

/**
 * クエリパラメータを削除する。
 *
 * @param url URL
 * @param key キー
 * @returns 新しい URL
 */
export function removeParam(url: string, key: string): string {
  return editSearch(url, (sp) => sp.delete(key));
}

/**
 * クエリパラメータの有無を判定する。
 *
 * @param url URL
 * @param key キー
 * @returns あれば true(**値が空でも true**)
 */
export function hasParam(url: string, key: string): boolean {
  return getParam(url, key) !== null;
}

/**
 * 指定したキーだけを残す(許可リスト)。
 *
 * **トラッキングパラメータ(`utm_*` など)を落とす**のに使う。
 * 除外リストではなく許可リストなのは、**知らないパラメータを残さない**ため。
 *
 * @param url URL
 * @param keys 残すキー
 * @returns 新しい URL
 */
export function keepParams(url: string, keys: string[]): string {
  const allow = new Set(keys);
  return editSearch(url, (sp) => {
    for (const key of [...new Set(sp.keys())]) if (!allow.has(key)) sp.delete(key);
  });
}
