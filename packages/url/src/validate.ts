/**
 * URL の検証・安全性判定(純ロジック)。
 * 妥当性、http(s) 限定(javascript:/data: の排除)、同一オリジン、外部リンク判定。
 * @packageDocumentation
 */

/**
 * 妥当な URL かを判定する(絶対 URL として解釈できるか)。
 *
 * **これだけでは安全ではない**。`javascript:alert(1)` も「妥当な URL」として通る。
 * リンク先に使うなら {@link isHttpUrl} を使うこと。
 *
 * @param url 判定する文字列
 * @returns 絶対 URL として解釈できれば true
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * http / https の URL かを判定する。
 *
 * **リンク先に使う前に必ず通す**。`javascript:` や `data:` を許すと、
 * リンクをクリックしただけで任意のコードが実行される(XSS)。
 *
 * @param url 判定する文字列
 * @returns http または https なら true
 */
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
 *
 * **利用者が入力した URL をリンクにする前に必ず通す**
 * (プロフィールの「ホームページ」欄など)。
 *
 * @param url 判定する文字列
 * @returns 安全なら true
 */
export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return false;
  // スキームが付いていれば http(s) のみ許可、無ければ相対とみなし許可
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) return isHttpUrl(trimmed);
  return true;
}

/**
 * 2 つの URL が同一オリジンかを判定する(scheme + host + port)。
 *
 * **リダイレクト先の検証に使う**。外部サイトへ飛ばす URL を利用者に指定させると、
 * フィッシングに使われる(オープンリダイレクト)。
 *
 * @param a URL
 * @param b URL
 * @returns 同一オリジンなら true。**どちらかが不正なら false**
 */
export function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/**
 * 外部リンクか(自サイトのホストと異なるか)。相対 URL は内部とみなす。
 *
 * **外部リンクには `rel="noopener"` を付ける**判断に使う。
 *
 * @param url 判定する URL
 * @param siteHost 自サイトのホスト名(例 "example.com")
 * @returns 外部なら true
 */
export function isExternalUrl(url: string, siteHost: string): boolean {
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) return false; // 相対=内部
  try {
    return new URL(url).hostname.toLowerCase() !== siteHost.toLowerCase().replace(/:\d+$/, "");
  } catch {
    return false;
  }
}
