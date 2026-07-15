/**
 * IPv4 / CIDR ユーティリティ(純)。アドレス変換・範囲判定・プライベート判定。
 * @packageDocumentation
 */

/** 妥当な IPv4 か。 */
export function isValidIpv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  return m.slice(1).every((o) => { const n = Number(o); return n >= 0 && n <= 255 && String(n) === o; });
}

/** IPv4 を 32bit 符号なし整数へ。不正なら null。 */
export function ipToLong(ip: string): number | null {
  if (!isValidIpv4(ip)) return null;
  return ip.split(".").reduce((acc, o) => (acc * 256 + Number(o)) >>> 0, 0) >>> 0;
}

/** 32bit 整数を IPv4 文字列へ。 */
export function longToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

/** CIDR("10.0.0.0/8")をパースする。不正なら null。 */
export function parseCidr(cidr: string): { network: number; prefix: number; mask: number } | null {
  const [ip, prefixStr] = cidr.split("/");
  if (ip === undefined || prefixStr === undefined) return null;
  const prefix = Number(prefixStr);
  const base = ipToLong(ip);
  if (base === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { network: (base & mask) >>> 0, prefix, mask };
}

/** IP が CIDR 範囲に含まれるか。 */
export function ipInCidr(ip: string, cidr: string): boolean {
  const addr = ipToLong(ip);
  const parsed = parseCidr(cidr);
  if (addr === null || parsed === null) return false;
  return ((addr & parsed.mask) >>> 0) === parsed.network;
}

const PRIVATE_RANGES = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "169.254.0.0/16"];

/** プライベート/ループバック/リンクローカルの IP か。 */
export function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => ipInCidr(ip, r));
}
