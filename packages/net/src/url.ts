/**
 * URL 組み立て・クエリ操作(純)。
 * @packageDocumentation
 */

/** URL/パスセグメントを結合する(重複スラッシュを畳む。クエリ/ハッシュは保持)。 */
export function joinUrl(base: string, ...segments: string[]): string {
  const [head, ...rest] = [base, ...segments].filter((s) => s !== "");
  if (head === undefined) return "";
  const tail = rest.map((s) => s.replace(/^\/+|\/+$/g, "")).filter((s) => s !== "");
  const joined = [head.replace(/\/+$/g, ""), ...tail].join("/");
  return joined;
}

/** クエリ文字列("a=1&b=2" または "?a=1")をオブジェクトへ。 */
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

/** オブジェクトをクエリ文字列へ(undefined/null は除外・キーでソート)。 */
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = [];
  for (const key of Object.keys(params).sort()) {
    const v = params[key];
    if (v === null || v === undefined) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}

/** URL にクエリを追加/マージする。 */
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
