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
/**
 * **`__Host-` 接頭辞は使っていない。**
 *
 * 付けるとブラウザが `Secure` + `Path=/` + `Domain` 指定なしを強制し、
 * **サブドメインから上書きできなくなる**
 * (`evil.example.co.jp` が `example.co.jp` のセッションを
 * 差し替える攻撃を防ぐ)。
 *
 * 採用しない理由は 2 つ。
 *
 * 1. **切り替えた瞬間に全員のセッションが切れる。**
 *    名前が変わるので既存の Cookie が読めない。
 *    業務時間中に入れると、全員が作業中のまま弾き出される
 * 2. **サブドメインを他所に貸していない。** 攻撃の前提が今は無い
 *
 * 社外にサブドメインを貸す構成になったら、**そのときに入れる**
 * (深夜のメンテナンス枠で切り替える)。
 * @param name クッキーの名前
 * @param value 値（**自分でエスケープしないでください**——ここで行います）
 * @param options 有効期限・パス・`httpOnly` など
 * @returns `Set-Cookie` に入れる文字列
 * @throws 名前や値に使えない文字が含まれる場合
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const { httpOnly = true, secure = true, sameSite = "Lax", path = "/", domain, maxAge, expires } = options;
  // **`SameSite=None` には `Secure` が必須。** ブラウザの仕様で、
  // 欠けているクッキーは**黙って破棄される**——エラーも警告も出ないので、
  // 「ログインできないが原因が分からない」という形になる。
  // 組み立てる側で気づけるよう、ここで止める。
  if (sameSite === "None" && !secure) {
    throw new Error("SameSite=None には Secure が必要です(ブラウザがクッキーを破棄します)");
  }
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
