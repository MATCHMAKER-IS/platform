/**
 * URL の検証・安全性判定(純ロジック)。
 * 妥当性、http(s) 限定(javascript:/data: の排除)、同一オリジン、外部リンク判定。
 * @packageDocumentation
 */

/** 妥当な URL か(絶対 URL として解釈できるか)。 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/** http/https の URL か(リンク先として安全。javascript:/data: 等を排除)。 */
export function isHttpUrl(url: string): boolean {
  try {
    const p = new URL(url).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
}

/**
 * リンクとして安全か。危険なスキーム(javascript:/data:/vbscript:/file:)を弾く。
 * 相対 URL は安全とみなす(同一サイト内)。
 */
export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return false;
  // スキームが付いていれば http(s) のみ許可、無ければ相対とみなし許可
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return isHttpUrl(trimmed);
  return true;
}

/** 2 つの URL が同一オリジン(scheme+host+port)か。 */
export function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/**
 * 外部リンクか(自サイトのホストと異なるか)。相対 URL は内部とみなす。
 * @param siteHost 自サイトのホスト名(例 "example.com")
 */
export function isExternalUrl(url: string, siteHost: string): boolean {
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) return false; // 相対=内部
  try {
    return new URL(url).hostname.toLowerCase() !== siteHost.toLowerCase().replace(/:\d+$/, "");
  } catch {
    return false;
  }
}
