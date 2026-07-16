/**
 * URL 組み立て・クエリ操作(純)。
 * @packageDocumentation
 */

/**
 * URL やパスを結合する。
 *
 * **重複スラッシュを畳む**が、**クエリとハッシュは保持する**(`?a=1#top` が消えない)。
 *
 * @param segments 結合するセグメント
 * @returns 結合した URL
 */
export function joinUrl(base: string, ...segments: string[]): string {
  const [head, ...rest] = [base, ...segments].filter((s) => s !== "");
  if (head === undefined) return "";
  const tail = rest.map((s) => s.replace(/^\/+|\/+$/g, "")).filter((s) => s !== "");
  const joined = [head.replace(/\/+$/g, ""), ...tail].join("/");
  return joined;
}

/**
 * クエリ文字列をオブジェクトにする。
 *
 * @param query クエリ文字列(**先頭の `?` はあってもなくてもよい**)
 * @returns キー → 値
 */
export function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  const s = qs.replace(/^\?/, "");
  if (s === "") return out;
  for (const pair of s.split("&")) {
    const idx = pair.indexOf("=");
    const k = idx < 0 ? pair : pair.slice(0, idx);
    const v = idx < 0 ? "" : pair.slice(idx + 1);
    if (k === "") continue;
    out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

/**
 * オブジェクトをクエリ文字列にする。
 *
 * **`undefined` / `null` は除外**(`?a=undefined` という文字列を送らない)。
 * **キー順にソート**するので、同じ内容なら常に同じ文字列になる。
 *
 * @param params キー → 値
 * @returns クエリ文字列
 */
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = [];
  for (const key of Object.keys(params).sort()) {
    const v = params[key];
    if (v === null || v === undefined) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

/**
 * URL にクエリを追加・マージする。
 *
 * @param url URL
 * @param params 追加するパラメータ
 * @returns 新しい URL(**既存のクエリは保持**)
 */
export function withQuery(url: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const hashIdx = url.indexOf("#");
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : "";
  const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const qIdx = noHash.indexOf("?");
  const path = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
  const existing = qIdx >= 0 ? parseQuery(noHash.slice(qIdx)) : {};
  const merged: Record<string, string | number | boolean | null | undefined> = { ...existing, ...params };
  const qs = buildQuery(merged);
  return `${path}${qs ? `?${qs}` : ""}${hash}`;
}
