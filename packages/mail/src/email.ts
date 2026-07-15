/**
 * メールアドレスの純ユーティリティ(検証・正規化・パース・整形)。
 * @packageDocumentation
 */

// 実務的な検証(RFC 完全準拠ではなく一般的なアドレスを許容)。
const EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

/** メールアドレスとして妥当か。 */
export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && EMAIL_RE.test(e);
}

/** 正規化(前後空白除去・小文字化)。gmail=true で Gmail のドット/+エイリアスも正規化。 */
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

/** ドメイン部を返す(無ければ "")。 */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).toLowerCase().trim();
}

/** 2 つのアドレスが同一ドメインか。 */
export function isSameDomain(a: string, b: string): boolean {
  const da = emailDomain(a);
  return da !== "" && da === emailDomain(b);
}

/** メールアドレス(表示名つき可)。 */
export interface EmailAddress { name?: string; email: string }

/** "山田 <yamada@example.jp>" 形式をパースする。 */
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

/** {name, email} を "山田 <yamada@example.jp>" に整形する。 */
export function formatAddress(addr: EmailAddress): string {
  if (!addr.name) return addr.email;
  const needsQuote = /[",<>@]/.test(addr.name);
  const name = needsQuote ? `"${addr.name.replace(/"/g, '\\"')}"` : addr.name;
  return `${name} <${addr.email}>`;
}

/** カンマ/セミコロン/改行区切りのアドレス列を配列にする(妥当なもののみ)。 */
export function parseEmailList(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s !== "")
    .map((s) => parseAddress(s)?.email)
    .filter((e): e is string => Boolean(e));
}

/** アドレス配列を大文字小文字を無視して重複排除する(初出の表記を保持)。 */
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
