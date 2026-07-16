/**
 * ドメイン処理(純ロジック)。
 * ホスト名から登録可能ドメイン(eTLD+1)・サブドメイン・TLD を取り出す。同一ドメイン判定など。
 * 多段 TLD(co.jp・co.uk 等)は代表的なものに対応(完全な Public Suffix List ではない)。
 * @packageDocumentation
 */

/** 代表的な多段パブリックサフィックス(登録は 3 段目)。 */
const MULTI_PART_SUFFIXES = new Set([
  // 日本
  "co.jp", "ne.jp", "or.jp", "go.jp", "ac.jp", "ad.jp", "ed.jp", "gr.jp", "lg.jp",
  // イギリス
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk",
  // その他よく使うもの
  "com.au", "net.au", "org.au", "co.nz", "com.br", "com.cn", "co.kr", "com.sg", "com.hk", "co.in", "com.tw",
]);

/**
 * ホスト名を正規化する(小文字化・末尾ドット / ポートの除去)。
 *
 * **比較の前に必ず通す**。`Example.COM` と `example.com.` と `example.com:443` は
 * すべて同じホストだが、文字列としては違う。
 *
 * @param host ホスト名または URL
 * @returns 正規化したホスト名
 */
export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
}

/**
 * URL またはホスト名からホスト名を取り出す。
 *
 * @param input URL またはホスト名
 * @returns 正規化したホスト名。**解釈できなければ空文字**
 */
export function getHostname(input: string): string | null {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input)) {
    try {
      return new URL(input).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
  return normalizeHostname(input);
}

/** IPv4 アドレスか。 */
function isIpv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/**
 * 登録可能ドメイン(eTLD+1)を返す。例: "www.example.co.jp" → "example.co.jp"。
 * IP や単一ラベルはそのまま返す。
 *
 * **eTLD+1 が「同じ組織か」の単位**。Cookie の共有範囲もこれで決まる。
 *
 * @param input URL またはホスト名
 * @returns 登録可能ドメイン。**解釈できなければ null**
 */
export function getRegistrableDomain(input: string): string | null {
  const host = getHostname(input);
  if (!host) return null;
  if (isIpv4(host) || host === "localhost") return host;
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  const take = MULTI_PART_SUFFIXES.has(lastTwo) ? 3 : 2;
  return parts.slice(-take).join(".");
}

/**
 * サブドメインを返す。
 *
 * @param input URL またはホスト名
 * @returns サブドメイン(`www.example.co.jp` → `www`)。**無ければ空文字**
 */
export function getSubdomain(input: string): string | null {
  const host = getHostname(input);
  const registrable = getRegistrableDomain(input);
  if (!host || !registrable) return null;
  if (host === registrable) return "";
  return host.slice(0, host.length - registrable.length - 1);
}

/**
 * TLD を返す。
 *
 * **多段の TLD にも対応**(`co.jp` を `jp` ではなく `co.jp` として扱う)。
 * これを間違えると、`example.co.jp` と `other.co.jp` を「同じドメイン」と誤判定する。
 *
 * @param input URL またはホスト名
 * @returns TLD
 */
export function getTld(input: string): string | null {
  const registrable = getRegistrableDomain(input);
  if (!registrable) return null;
  const parts = registrable.split(".");
  return parts.slice(1).join(".");
}

/**
 * 先頭の `www.` を除いたホスト名を返す。
 *
 * **表示用**(`www.example.com` より `example.com` の方が読みやすい)。
 * 比較には使わないこと(`www` 有無で別サイトのこともある)。
 *
 * @param input URL またはホスト名
 * @returns `www.` を除いたホスト名
 */
export function stripWww(input: string): string | null {
  const host = getHostname(input);
  return host ? host.replace(/^www\./, "") : null;
}

/**
 * 2 つが同じ登録可能ドメインかを判定する(**サブドメインの差は無視**)。
 *
 * `mail.example.com` と `www.example.com` は true。
 * **Cookie の共有範囲やメールの送信元検証**に使う。
 *
 * @param a URL またはホスト名
 * @param b URL またはホスト名
 * @returns 同じ登録可能ドメインなら true
 */
export function isSameDomain(a: string, b: string): boolean {
  const da = getRegistrableDomain(a);
  const db = getRegistrableDomain(b);
  return da !== null && da === db;
}

/**
 * 2 つのホストが完全一致するかを判定する(**サブドメインも含めて**)。
 *
 * @param a URL またはホスト名
 * @param b URL またはホスト名
 * @returns 完全一致なら true
 */
export function isSameHost(a: string, b: string): boolean {
  const ha = getHostname(a);
  const hb = getHostname(b);
  return ha !== null && ha === hb;
}
