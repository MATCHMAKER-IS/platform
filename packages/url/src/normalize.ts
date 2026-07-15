/**
 * URL 正規化(純ロジック)。
 * 表記ゆれを吸収して比較・重複排除しやすい形にする。トラッキングパラメータの除去も。
 * @packageDocumentation
 */

/** 正規化のオプション。 */
export interface NormalizeOptions {
  /** 末尾スラッシュを除去(既定 true。ルートは除く)。 */
  stripTrailingSlash?: boolean;
  /** ハッシュ(#...)を除去(既定 false)。 */
  stripHash?: boolean;
  /** クエリをキー順にソート(既定 true)。 */
  sortQuery?: boolean;
  /** "www." を除去(既定 false)。 */
  stripWww?: boolean;
  /** 除去するクエリパラメータ(既定はトラッキング系)。 */
  removeParams?: string[];
}

/** 既定で除去するトラッキングパラメータ。 */
export const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "gclid", "fbclid", "mc_cid", "mc_eid", "_ga", "yclid", "msclkid",
];

/**
 * URL を正規化する。scheme/host は小文字化、既定ポート除去、末尾スラッシュ・トラッキング除去など。
 * 不正な URL はそのまま返す。
 */
export function normalizeUrl(url: string, options: NormalizeOptions = {}): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const stripTrailingSlash = options.stripTrailingSlash ?? true;
  const sortQuery = options.sortQuery ?? true;
  const removeParams = options.removeParams ?? TRACKING_PARAMS;

  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase();
  if (options.stripWww) u.hostname = u.hostname.replace(/^www\./, "");

  for (const p of removeParams) u.searchParams.delete(p);
  if (sortQuery) u.searchParams.sort();

  if (options.stripHash) u.hash = "";

  // 末尾スラッシュ除去(ルート "/" は残す)
  if (stripTrailingSlash && u.pathname !== "/" && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.replace(/\/+$/, "");
  }

  let result = u.toString();
  // 空クエリの余分な "?" を消す
  result = result.replace(/\?(#|$)/, "$1");
  return result;
}

/** 2 つの URL が正規化後に等しいか。 */
export function urlsEqual(a: string, b: string, options?: NormalizeOptions): boolean {
  return normalizeUrl(a, options) === normalizeUrl(b, options);
}
