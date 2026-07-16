/**
 * メールアドレスの純ユーティリティ(検証・正規化・パース・整形)。
 * @packageDocumentation
 */

// 実務的な検証(RFC 完全準拠ではなく一般的なアドレスを許容)。
const EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/**
 * メールアドレスとして妥当かを判定する。
 *
 * **完全な検証はできない**(RFC 5322 は複雑すぎる)。**送ってみるまで届くか分からない**。
 *
 * @param email メールアドレス
 * @returns 妥当そうなら true
 */
export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && EMAIL_RE.test(e);
}

/**
 * メールアドレスを正規化する。
 *
 * **Gmail はドットを無視し、`+` 以降をエイリアスとして扱う**
 * (`a.b+tag@gmail.com` と `ab@gmail.com` は同じ人)。重複登録を防ぐなら
 * `gmail: true` を指定する。ただし**他のプロバイダでは別のアドレス**なので、
 * 一律に適用しないこと。
 *
 * @param email メールアドレス
 * @param options.gmail Gmail の正規化をするか
 * @returns 正規化したアドレス
 */
export function normalizeEmail(email: string, options: { gmail?: boolean } = {}): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return e;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (options.gmail && (domain === "gmail.com" || domain === "googlemail.com")) {
    local = local.split("+")[0]!.replace(/\./g, "");
    return `${local}@gmail.com`;
  }
  return `${local}@${domain}`;
}

/**
 * ドメイン部を返す(無ければ "")。
 *
 *
 * @param email メールアドレス
 * @returns ドメイン。**@ が無ければ空文字**
 */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).toLowerCase().trim();
}

/**
 * 2 つのアドレスが同一ドメインかを判定する。
 *
 * **社内・社外の判定**に使う。
 *
 * @param a メールアドレス
 * @param b メールアドレス
 * @returns 同一ドメインなら true
 */
export function isSameDomain(a: string, b: string): boolean {
  const da = emailDomain(a);
  return da !== "" && da === emailDomain(b);
}

/** メールアドレス(表示名つき可)。 */
export interface EmailAddress { name?: string; email: string }

/**
 * `山田 <yamada@example.jp>` 形式を解析する。
 *
 * @param input 表示名つきのアドレス
 * @returns 表示名とアドレス。**表示名が無ければ name は空**
 */
export function parseAddress(input: string): EmailAddress | null {
  const s = input.trim();
  const m = s.match(/^\s*(?:"?([^"<]*?)"?\s*)?<\s*([^>]+?)\s*>\s*$/);
  if (m) {
    const email = m[2]!.trim();
    if (!isValidEmail(email)) return null;
    const name = (m[1] ?? "").trim();
    return name ? { name, email } : { email };
  }
  return isValidEmail(s) ? { email: s } : null;
}

/**
 * {name, email} を "山田 <yamada@example.jp>" に整形する。
 *
 *
 * @param name 表示名
 * @param email メールアドレス
 * @returns `山田 <yamada@example.jp>` 形式(**表示名に `,` や `<` があれば引用符で囲む**)
 */
export function formatAddress(addr: EmailAddress): string {
  if (!addr.name) return addr.email;
  const needsQuote = /[",<>@]/.test(addr.name);
  const name = needsQuote ? `"${addr.name.replace(/"/g, '\\"')}"` : addr.name;
  return `${name} <${addr.email}>`;
}

/**
 * カンマ/セミコロン/改行区切りのアドレス列を配列にする(妥当なもののみ)。
 *
 *
 * @param input カンマ区切りのアドレス
 * @returns アドレスの配列(**引用符内のカンマは区切りにしない**)
 */
export function parseEmailList(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => parseAddress(s)?.email)
    .filter((e): e is string => Boolean(e));
}

/**
 * アドレス配列を大文字小文字を無視して重複排除する(初出の表記を保持)。
 *
 *
 * @param emails アドレスの配列
 * @returns 重複を除いた配列(**正規化して比較する**ので、大文字小文字の違いは同じものとして扱う)
 */
export function dedupeEmails(emails: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const key = e.trim().toLowerCase();
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    out.push(e.trim());
  }
  return out;
}
