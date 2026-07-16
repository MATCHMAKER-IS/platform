/**
 * IPv4 / CIDR ユーティリティ(純)。アドレス変換・範囲判定・プライベート判定。
 * @packageDocumentation
 */

/**
 * 妥当な IPv4 かを判定する。
 *
 * @param ip 判定する文字列
 * @returns 妥当なら true
 */
export function isValidIpv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((o) => { const n = Number(o); return n >= 0 && n <= 255 && String(n) === o; });
}

/**
 * IPv4 を 32bit の整数にする。
 *
 * **範囲の比較を高速にする**ため(文字列のままでは比較できない)。
 *
 * @param ip IPv4 文字列
 * @returns 整数。**不正なら null**
 */
export function ipToLong(ip: string): number | null {
  if (!isValidIpv4(ip)) return null;
  return ip.split(".").reduce((acc, o) => (acc * 256 + Number(o)) >>> 0, 0) >>> 0;
}

/**
 * 32bit の整数を IPv4 文字列にする。
 *
 * @param n 整数
 * @returns IPv4 文字列
 */
export function longToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

/**
 * CIDR 表記を解析する(`10.0.0.0/8`)。
 *
 * @param cidr CIDR 文字列
 * @returns ネットワークアドレスとマスク。**不正なら null**
 */
export function parseCidr(cidr: string): { network: number; prefix: number; mask: number } | null {
  const [ip, prefixStr] = cidr.split("/");
  if (ip === undefined || prefixStr === undefined) return null;
  const prefix = Number(prefixStr);
  const base = ipToLong(ip);
  if (base === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: (base & mask) >>> 0, prefix, mask };
}

/**
 * IP が CIDR の範囲に含まれるかを判定する。
 *
 * **社内 IP からのアクセスだけ許す**といった制限に使う。
 *
 * @param ip IPv4 文字列
 * @param cidr CIDR 文字列
 * @returns 含まれれば true。**どちらかが不正なら false**(安全側)
 */
export function ipInCidr(ip: string, cidr: string): boolean {
  const addr = ipToLong(ip);
  const parsed = parseCidr(cidr);
  if (addr === null || parsed === null) return false;
  return ((addr & parsed.mask) >>> 0) === parsed.network;
}

const PRIVATE_RANGES = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "169.254.0.0/16"];

/**
 * プライベート IP かを判定する(ループバック・リンクローカルを含む)。
 *
 * **SSRF 対策に使う**。利用者が指定した URL を叩く前に、宛先が内部ネットワークで
 * ないことを確認する(`http://192.168.0.1/` を叩かせて内部を探られるのを防ぐ)。
 *
 * @param ip IPv4 文字列
 * @returns プライベート IP なら true
 */
export function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => ipInCidr(ip, r));
}
