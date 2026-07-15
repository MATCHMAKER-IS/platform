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

/** Cookie ヘッダ文字列を名前→値のオブジェクトにする。 */
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

/** 1 件の Cookie ヘッダ文字列から特定の値を取り出す。 */
export function getCookie(header: string | null | undefined, name: string): string | null {
  return parseCookies(header)[name] ?? null;
}

/** Set-Cookie 文字列を生成する。 */
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

/** クッキーを失効させる Set-Cookie 文字列を生成する。 */
export function clearCookie(name: string, options: CookieOptions = {}): string {
  return serializeCookie(name, "", { ...options, maxAge: 0, expires: new Date(0) });
}
