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
  /**
   * インライン script を許可する使い捨ての値(nonce)。
   *
   * **Next.js はページの起動に必ずインライン script を使う。**
   * `script-src 'self'` だけだとそれが全部ブロックされ、
   * **画面は出るがボタンが何も反応しない**(ハイドレーションが動かない)。
   * コンソールには「Executing inline script violates ... 'script-src 'self''」が並ぶ。
   *
   * `'unsafe-inline'` で通すこともできるが、それでは XSS への防御が無くなる。
   * **リクエストごとに使い捨ての値を作り、それだけを許可する**のが正しい形。
   * 値は {@link createCspNonce} で作る。
   */
  nonce?: string;
  /**
   * `eval` を許可するか(**開発時のみ**)。
   *
   * Next.js の dev サーバは差分更新に `eval` を使うため、
   * 無いと開発中だけ画面が動かない。**本番では必ず false**(既定)。
   */
  allowEval?: boolean;
}

/**
 * 既定の CSP を組み立てる。
 *
 * `script-src` だけは nonce と eval の指定で変わるので、ここで作る。
 * `'strict-dynamic'` を付けるのは、**nonce を付けた script が読み込む
 * 別の script も通す**ため(Next.js はチャンクを動的に読む)。
 */
function buildCsp(nonce?: string, allowEval = false): string {
  const scriptSrc = ["script-src 'self'"];
  if (nonce !== undefined) scriptSrc.push(`'nonce-${nonce}'`, "'strict-dynamic'");
  if (allowEval) scriptSrc.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    scriptSrc.join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * インライン script を許可する使い捨ての値(nonce)を作る。
 *
 * **リクエストごとに新しく作ること。** 使い回すと、値を知った攻撃者が
 * 任意の script を通せるようになり、CSP の意味が無くなる。
 *
 * @returns base64 の乱数(16 バイト)
 *
 * @example
 * ```ts
 * const nonce = createCspNonce();
 * const headers = securityHeaders({ nonce, allowEval: process.env.NODE_ENV !== "production" });
 * ```
 */
export function createCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

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
  const { hsts = true, frameOptions = "DENY", nonce, allowEval = false } = options;
  const contentSecurityPolicy = options.contentSecurityPolicy ?? buildCsp(nonce, allowEval);
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
