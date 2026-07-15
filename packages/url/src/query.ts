/**
 * クエリパラメータ操作(純ロジック)。
 * URL 全体を保ったままクエリの取得・追加・更新・削除を行う。クエリ文字列の解析/組み立ても。
 * @packageDocumentation
 */

/** クエリ文字列をオブジェクトに解析する(同名キーは配列)。 */
export function parseQuery(search: string): Record<string, string | string[]> {
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    out[key] = all.length > 1 ? all : all[0]!;
  }
  return out;
}

/** オブジェクトをクエリ文字列に組み立てる(キー順ソート・先頭 ? なし)。 */
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

/** クエリパラメータを取得する(複数あれば最初の 1 つ)。 */
export function getParam(url: string, key: string): string | null {
  const qIndex = url.indexOf("?");
  if (qIndex < 0) return null;
  const hashIndex = url.indexOf("#");
  const query = hashIndex >= 0 ? url.slice(qIndex + 1, hashIndex) : url.slice(qIndex + 1);
  return new URLSearchParams(query).get(key);
}

/** パラメータを設定する(既存は置き換え)。 */
export function setParam(url: string, key: string, value: string | number | boolean): string {
  return editSearch(url, (sp) => sp.set(key, String(value)));
}

/** 複数パラメータをまとめて設定する。 */
export function setParams(url: string, params: Record<string, string | number | boolean | null | undefined>): string {
  return editSearch(url, (sp) => {
    for (const [k, v] of Object.entries(params)) {
      if (v === null || v === undefined) sp.delete(k);
      else sp.set(k, String(v));
    }
  });
}

/** パラメータを追加する(同名を残して増やす)。 */
export function appendParam(url: string, key: string, value: string | number): string {
  return editSearch(url, (sp) => sp.append(key, String(value)));
}

/** パラメータを削除する。 */
export function removeParam(url: string, key: string): string {
  return editSearch(url, (sp) => sp.delete(key));
}

/** パラメータの有無を返す。 */
export function hasParam(url: string, key: string): boolean {
  return getParam(url, key) !== null;
}

/** 指定キー群だけを残す(許可リスト)。 */
export function keepParams(url: string, keys: string[]): string {
  const allow = new Set(keys);
  return editSearch(url, (sp) => {
    for (const key of [...new Set(sp.keys())]) if (!allow.has(key)) sp.delete(key);
  });
}
