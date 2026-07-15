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

/** ホスト名を正規化する(小文字化・末尾ドット/ポート除去)。 */
export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
}

/** URL かホスト名からホスト名を取り出す。 */
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

/** サブドメインを返す(登録可能ドメインの手前部分)。無ければ ""。 */
export function getSubdomain(input: string): string | null {
  const host = getHostname(input);
  const registrable = getRegistrableDomain(input);
  if (!host || !registrable) return null;
  if (host === registrable) return "";
  return host.slice(0, host.length - registrable.length - 1);
}

/** TLD(最後のラベル、多段なら多段ぶん)を返す。 */
export function getTld(input: string): string | null {
  const registrable = getRegistrableDomain(input);
  if (!registrable) return null;
  const parts = registrable.split(".");
  return parts.slice(1).join(".");
}

/** 先頭の "www." を除いたホスト名を返す。 */
export function stripWww(input: string): string | null {
  const host = getHostname(input);
  return host ? host.replace(/^www\./, "") : null;
}

/** 2 つの入力が同じ登録可能ドメインか(サブドメイン差を無視)。 */
export function isSameDomain(a: string, b: string): boolean {
  const da = getRegistrableDomain(a);
  const db = getRegistrableDomain(b);
  return da !== null && da === db;
}

/** 2 つのホストが完全一致か(サブドメインも含めて)。 */
export function isSameHost(a: string, b: string): boolean {
  const ha = getHostname(a);
  const hb = getHostname(b);
  return ha !== null && ha === hb;
}
