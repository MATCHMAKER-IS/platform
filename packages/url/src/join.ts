/**
 * URL・パスの結合(純)。
 * @packageDocumentation
 */

/**
 * URL やパスを結合する。
 *
 * **重複スラッシュを畳む**が、**クエリとハッシュは保持する**(`?a=1#top` が消えない)。
 *
 * もとは `@platform/net` にあったが、URL 文字列の操作は
 * `@platform/url` に集約する方針(ADR 0015)に合わせて移した。
 *
 * @param base     先頭のセグメント
 * @param segments 続けて結合するセグメント
 * @returns 結合した URL
 *
 * @example
 * ```ts
 * joinUrl("https://x.jp/", "/v1/", "/u"); // "https://x.jp/v1/u"
 * ```
 */
export function joinUrl(base: string, ...segments: string[]): string {
  const [head, ...rest] = [base, ...segments].filter((s) => s !== "");
  if (head === undefined) return "";
  const tail = rest.map((s) => s.replace(/^\/+|\/+$/g, "")).filter((s) => s !== "");
  return [head.replace(/\/+$/g, ""), ...tail].join("/");
}
