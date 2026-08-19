import { bytesToBase64 } from "@platform/bytes";
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
  /**
   * `Cross-Origin-Resource-Policy` の値(既定 `"same-origin"`)。
   *
   * **他サイトからこのサーバの画像や JS を直接読ませない**ための指定。
   * CDN や別ドメインの社内アプリから読ませる必要があるときだけ
   * `"cross-origin"` にする——**広げると、埋め込みでの情報漏れを防げなくなる**。
   *
   * 実装は 2026-08 の時点でこの値を読んでいたが、**この型に無かった**ため
   * 呼び出し側から渡せず、型検査も通らなかった。
   */
  resourcePolicy?: "same-origin" | "same-site" | "cross-origin";
}

/**
 * 既定の CSP を組み立てる。
 *
 * `script-src` だけは nonce と eval の指定で変わるので、ここで作る。
 * `'strict-dynamic'` を付けるのは、**nonce を付けた script が読み込む
 * 別の script も通す**ため(Next.js はチャンクを動的に読む)。
 */
/**
 * 埋め込みを許す先(CSP `frame-src`)。
 *
 * **`sanitizeEmbed` と揃える。**
 * 片方だけ許しても、もう片方で止まる。
 * ここが緩いと、サニタイズを抜けた `<iframe>` が生きてしまう
 * (二重の守り)。
 */
const FRAME_SRC = [
  "https://www.youtube.com", "https://youtube.com", "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
  "https://www.google.com", "https://maps.google.com", "https://docs.google.com",
  "https://www.slideshare.net",
];

function buildCsp(nonce?: string, allowEval = false): string {
  // **`'self'` は nonce を使うと無視される。** それでも残すのは、
  // `'strict-dynamic'` を理解しない古いブラウザ(CSP Level 2)への保険。
  // 新しいブラウザは `'strict-dynamic'` を見て `'self'` を無視し、
  // 古いブラウザは `'strict-dynamic'` を無視して `'self'` で判断する
  // ——**どちらでも動くのが狙い**で、書き間違いではない。
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
    // **自分が埋め込まれる側の防御。** クリックジャッキングを防ぐ
    "frame-ancestors 'none'",
    // **自分が埋め込む側の制限。**
    // これが無いと、サニタイズを抜けた `<iframe>` が動く
    `frame-src ${FRAME_SRC.join(" ")}`,
    // **フォームの送信先を自分のサイトに限る。**
    // `default-src` では拾われない(仕様上、別のディレクティブ)。
    // 差し込まれた `<form action="https://evil.example">` に
    // 入力を送られるのを防ぐ
    "form-action 'self'",
    // **通信先を自分のサイトに限る。**
    // `fetch` / `XMLHttpRequest` / WebSocket が対象。
    // 差し込まれたスクリプトが外へ持ち出すのを止める
    "connect-src 'self'",
    // **Worker は自分のものだけ。**
    // `blob:` を許すと、文字列から Worker を作れてしまう
    "worker-src 'self'",
    // **フォントと音声・動画も自分のものだけ。**
    // `default-src` で拾われるが、**明示しておくと意図が伝わる**
    "font-src 'self'",
    "media-src 'self'",
    // **平文の読み込みを昇格させる。**
    // 混在コンテンツで警告が出るより、https で取りにいく
    "upgrade-insecure-requests",
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
  // **`@platform/bytes` に寄せた**(2026-08)。
  // ここは 16 バイトなので `String.fromCharCode(...bytes)` でも動くが、
  // **同じ形が大きな入力に複製されると `RangeError` で落ちる**
  return bytesToBase64(bytes);
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
  const {
    hsts = true, frameOptions = "DENY", nonce, allowEval = false,
    resourcePolicy = "same-origin",
  } = options;
  const contentSecurityPolicy = options.contentSecurityPolicy ?? buildCsp(nonce, allowEval);
  const headers: Record<string, string> = {
    "Content-Security-Policy": contentSecurityPolicy,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": frameOptions,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "X-DNS-Prefetch-Control": "off",
    // **他のサイトから window を掴ませない。**
    // `window.open` で開かれた側から `window.opener` を触られると、
    // 元のページを別の URL へ飛ばせる(偽のログイン画面に差し替えられる)
    "Cross-Origin-Opener-Policy": "same-origin",
    // **他のサイトから読み込ませない。**
    // 画像やスクリプトとして読み込んで中身を推測する攻撃を防ぐ。
    //
    // **公開サイトは `cross-origin` にする。**
    // `same-origin` のままだと、SNS で共有したときに OGP 画像が出ない
    // (X や Slack が別ドメインから取りに来るため)。
    // 社内アプリは外から読まれる理由が無いので `same-origin`
    "Cross-Origin-Resource-Policy": resourcePolicy,
    // **支払い・USB・センサーも止める。**
    // 使う画面ができたら、そこだけ緩める
    // (`Permissions-Policy` は上で camera/microphone/geolocation を止めている)
  };
  if (hsts) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}
