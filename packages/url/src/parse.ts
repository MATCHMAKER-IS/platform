/**
 * URL の解析・組み立て(純ロジック)。
 * URL を構成要素(プロトコル/ホスト/パス/クエリ/ハッシュ)に分解し、部品から URL を組み立てる。
 * 標準の URL API を用いる。相対 URL は base を与えて解決する。
 * @packageDocumentation
 */

/** URL の構成要素。 */
export interface UrlParts {
  /** プロトコル(コロンなし。例 "https")。 */
  protocol: string;
  /** ホスト名(例 "example.com")。 */
  hostname: string;
  /** ポート(既定ポートは空)。 */
  port: string;
  /** パス(例 "/blog/a")。 */
  pathname: string;
  /** クエリ文字列(先頭 "?" なし。例 "a=1&b=2")。 */
  search: string;
  /** ハッシュ(先頭 "#" なし。例 "section")。 */
  hash: string;
  /** オリジン(例 "https://example.com")。 */
  origin: string;
}

/**
 * 絶対 URL かを判定する(スキーム付きか)。
 *
 * @param url 判定する文字列
 * @returns 絶対 URL なら true
 */
export function isAbsoluteUrl(url: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) && !url.startsWith("/");
}

/**
 * URL を解析して構成要素に分解する。
 *
 * @param url URL(**相対 URL なら base で解決する**)
 * @param base 相対 URL の基準
 * @returns 構成要素。**不正なら null**(例外を投げない)
 */
export function parseUrl(url: string, base?: string): UrlParts | null {
  let u: URL;
  try {
    u = base !== undefined ? new URL(url, base) : new URL(url);
  } catch {
    return null;
  }
  return {
    protocol: u.protocol.replace(/:$/, ""),
    hostname: u.hostname,
    port: u.port,
    pathname: u.pathname,
    search: u.search.replace(/^\?/, ""),
    hash: u.hash.replace(/^#/, ""),
    origin: u.origin,
  };
}

/**
 * 構成要素から URL 文字列を組み立てる。
 *
 * @param parts 構成要素(scheme / host / path / query など)
 * @returns URL 文字列
 */
export function buildUrl(parts: Partial<UrlParts> & { protocol: string; hostname: string }): string {
  const port = parts.port ? `:${parts.port}` : "";
  let path = parts.pathname ?? "/";
  if (!path.startsWith("/")) path = "/" + path;
  const search = parts.search ? `?${parts.search.replace(/^\?/, "")}` : "";
  const hash = parts.hash ? `#${parts.hash.replace(/^#/, "")}` : "";
  return `${parts.protocol}://${parts.hostname}${port}${path}${search}${hash}`;
}

/**
 * URL からオリジンを取り出す(scheme://host:port)。
 *
 * @param url URL
 * @returns オリジン。**解釈できなければ空文字**
 */
export function getOrigin(url: string): string | null {
  return parseUrl(url)?.origin ?? null;
}

/**
 * URL からパス部分だけを取り出す。
 *
 * @param url URL
 * @returns パス。**解釈できなければ空文字**
 */
export function getPath(url: string, base?: string): string | null {
  return parseUrl(url, base)?.pathname ?? null;
}
