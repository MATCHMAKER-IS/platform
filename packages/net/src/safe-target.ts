/**
 * 外向きの通信先が安全かを見る。
 *
 * 【なぜ要るか】
 * **利用者が指定した URL をそのまま叩くと、踏み台になる(SSRF)。**
 * `169.254.169.254` はクラウドのメタデータで、
 * 叩けば**資格情報が取れる**。`10.0.1.5` のような社内アドレスも同じ。
 *
 * こちらのサーバは社内から見えるので、
 * 外からは届かない場所へ代わりに要求を送ることになる。
 *
 * 【どこで使うか】
 * - Webhook の送信先(管理画面から登録される)
 * - 接続テスト(利用者がその場で入力する)
 * - 画像の取り込み・URL のプレビュー
 * @packageDocumentation
 */

/** {@link isSafeExternalUrl} の設定。 */
export interface SafeUrlOptions {
  /**
   * http を許すか(既定 false)。
   *
   * **平文だと本文と署名が盗聴される。**
   * 開発環境で自前の受け口を試すときだけ true にする。
   */
  allowHttp?: boolean;
}

/** 判定できない・危ない理由。 */
export type UnsafeReason =
  | "malformed"      // URL として読めない
  | "scheme"         // http(s) 以外、または http を許していない
  | "loopback"       // 自分自身
  | "private"        // 私有アドレス
  | "link-local"     // 169.254.x.x(クラウドのメタデータ)
  | "internal-name"; // .internal / .local のような内部の名前

/**
 * 外へ送ってよい URL かを見る。
 *
 * **名前解決はしない。** ここは形だけの判定で、
 * `evil.example` が社内アドレスを指す DNS リバインディングは防げない。
 * 完全に防ぐなら、送信を専用の出口(プロキシ)経由にする必要がある。
 * **それでも、素朴な指定はここで止まる。**
 *
 * **これは「サーバから叩いてよいか」の判定で、「リンクにしてよいか」ではない。**
 * 画面に出すリンクの検証には `@platform/url` の `isSafeUrl` を使うこと
 * (あちらは `javascript:` などのスキームを弾く。こちらは見ていない)。
 * 名前が似ているので取り違えやすい。
 *
 * @param raw URL 文字列
 * @param options 設定
 * @returns 安全なら `{ ok: true }`、駄目なら理由付き
 *
 * @example
 * ```ts
 * const v = isSafeExternalUrl(subscription.url);
 * if (!v.ok) {
 *   console.warn(`送信先として許可されていません(${v.reason}): ${subscription.url}`);
 *   return;
 * }
 * await fetch(subscription.url, { redirect: "manual" });
 * ```
 */
export function isSafeExternalUrl(
  raw: string,
  options: SafeUrlOptions = {},
): { ok: true } | { ok: false; reason: UnsafeReason } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const allowHttp = options.allowHttp ?? false;
  if (u.protocol !== "https:" && !(allowHttp && u.protocol === "http:")) {
    return { ok: false, reason: "scheme" };
  }

  // **角括弧を外す。** IPv6 は `[::1]` の形で入る
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost")) return { ok: false, reason: "loopback" };
  if (host === "::1" || /^127\./.test(host)) return { ok: false, reason: "loopback" };
  if (host === "0.0.0.0" || host === "::") return { ok: false, reason: "loopback" };

  // **クラウドのメタデータ。** 叩くと資格情報が取れる
  if (/^169\.254\./.test(host) || host.startsWith("fe80:")) {
    return { ok: false, reason: "link-local" };
  }

  // 私有アドレス(IPv4)
  if (/^10\./.test(host)) return { ok: false, reason: "private" };
  if (/^192\.168\./.test(host)) return { ok: false, reason: "private" };
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return { ok: false, reason: "private" };
  // 私有アドレス(IPv6 の ULA)
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return { ok: false, reason: "private" };

  // 内部向けの名前。**社内 DNS でしか引けない**
  if (/\.(internal|local|lan|home|corp|intranet)$/.test(host)) {
    return { ok: false, reason: "internal-name" };
  }

  return { ok: true };
}

/**
 * 理由を日本語にする(画面やログに出す用)。
 *
 * @param reason 判定の理由
 * @returns 危ない理由の説明。**安全なら `undefined`**（理由が無い＝通してよい）
 */
export function describeUnsafeReason(reason: UnsafeReason): string {
  switch (reason) {
    case "malformed": return "URL の形式が正しくありません";
    case "scheme": return "https のアドレスを指定してください";
    case "loopback": return "自分自身のアドレスは指定できません";
    case "private": return "社内のアドレスは指定できません";
    case "link-local": return "このアドレスは指定できません";
    case "internal-name": return "社内向けの名前は指定できません";
  }
}
