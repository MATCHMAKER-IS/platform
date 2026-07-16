/**
 * クッキーの読み書き(フレームワーク非依存)。
 * Cookie ヘッダのパースと Set-Cookie 文字列の生成を行う。
 * 値は既定で URL エンコード/デコードする(封緘トークン等の安全な格納のため)。
 * @packageDocumentation
 */

/** Set-Cookie の属性。 */
export interface CookieOptions {
  /** JS から読めなくする(既定 true)。 */
  httpOnly?: boolean;
  /** HTTPS のみ送信(既定 true)。 */
  secure?: boolean;
  /** SameSite(既定 "Lax")。 */
  sameSite?: "Strict" | "Lax" | "None";
  /** パス(既定 "/")。 */
  path?: string;
  /** ドメイン。 */
  domain?: string;
  /** 有効期間(秒)。 */
  maxAge?: number;
  /** 失効日時。 */
  expires?: Date;
}

/**
 * Cookie ヘッダを名前 → 値の辞書にする。
 *
 * @param header `Cookie` ヘッダの値(`a=1; b=2`)
 * @returns 名前 → 値。**ヘッダが無ければ空**
 */
export function parseCookies(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (!name) continue;
    const value = part.slice(idx + 1).trim();
    try { out[name] = decodeURIComponent(value); } catch { out[name] = value; }
  }
  return out;
}

/**
 * Cookie ヘッダから特定の値を取り出す。
 *
 * @param header `Cookie` ヘッダの値
 * @param name 取り出す名前
 * @returns 値。**無ければ undefined**
 */
export function getCookie(header: string | null | undefined, name: string): string | null {
  return parseCookies(header)[name] ?? null;
}

/**
 * `Set-Cookie` ヘッダの値を組み立てる。
 *
 * **セッション Cookie には `httpOnly` と `secure` を必ず付ける**。
 * httpOnly が無いと JavaScript から読めてしまい、XSS でセッションを盗まれる。
 * secure が無いと平文の HTTP で送信される。
 *
 * `sameSite` は既定で `lax`(CSRF を防ぎつつ、外部リンクからの遷移では送られる)。
 *
 * @param name Cookie 名
 * @param value 値
 * @param options.maxAge 有効期間(秒)
 * @param options.httpOnly JavaScript から読めなくするか
 * @param options.secure HTTPS のみで送るか
 * @param options.sameSite CSRF 対策(既定 lax)
 * @param options.path 対象パス(既定 `/`)
 * @returns `Set-Cookie` に渡す文字列
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const { httpOnly = true, secure = true, sameSite = "Lax", path = "/", domain, maxAge, expires } = options;
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${path}`);
  if (domain) parts.push(`Domain=${domain}`);
  if (maxAge != null) parts.push(`Max-Age=${Math.floor(maxAge)}`);
  if (expires) parts.push(`Expires=${expires.toUTCString()}`);
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  parts.push(`SameSite=${sameSite}`);
  return parts.join("; ");
}

/**
 * Cookie を失効させる `Set-Cookie` を組み立てる(ログアウト用)。
 *
 * **設定時と同じ `path` / `domain` を指定すること**。違うと消えず、ログアウトしたつもりが
 * セッションが残る。
 *
 * @param name Cookie 名
 * @param options.path 対象パス(**設定時と同じ値**)
 * @param options.domain 対象ドメイン(設定時と同じ値)
 * @returns `Set-Cookie` に渡す文字列
 */
export function clearCookie(name: string, options: CookieOptions = {}): string {
  return serializeCookie(name, "", { ...options, maxAge: 0, expires: new Date(0) });
}
