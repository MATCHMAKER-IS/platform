/**
 * セキュリティ HTTP ヘッダ。XSS・クリックジャッキング・MIME スニッフィング等の
 * 一般的な脆弱性を、レスポンスヘッダで緩和する(helmet 相当の最小構成)。
 * @packageDocumentation
 */

/** {@link securityHeaders} のオプション。 */
export interface SecurityHeadersOptions {
  /** Content-Security-Policy の値。省略時は自己ホスト中心の安全既定。 */
  contentSecurityPolicy?: string;
  /** HSTS を有効にするか(HTTPS 運用時に true。既定 true)。 */
  hsts?: boolean;
  /** フレーム埋め込みポリシー(既定 "DENY")。 */
  frameOptions?: "DENY" | "SAMEORIGIN";
}

const DEFAULT_CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * セキュリティヘッダのマップを返す。Next の middleware やレスポンスに適用する。
 *
 * @param options CSP・HSTS・フレームポリシー
 * @returns ヘッダ名 → 値
 *
 * @example
 * ```ts
 * const headers = securityHeaders();
 * for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
 * ```
 */
export function securityHeaders(options: SecurityHeadersOptions = {}): Record<string, string> {
  const { contentSecurityPolicy = DEFAULT_CSP, hsts = true, frameOptions = "DENY" } = options;
  const headers: Record<string, string> = {
    "Content-Security-Policy": contentSecurityPolicy,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": frameOptions,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "X-DNS-Prefetch-Control": "off",
  };
  if (hsts) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}
