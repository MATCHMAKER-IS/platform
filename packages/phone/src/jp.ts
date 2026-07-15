/**
 * 日本の電話番号ユーティリティ(純)。正規化・検証・種別判定・整形・E.164 変換。
 * @packageDocumentation
 */

/** 全角数字・記号を半角へ。 */
function toHalfWidth(s: string): string {
  return s.replace(/[０-９＋－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[‐-‒–—―ー−]/g, "-");
}

/**
 * 国内表記の数字列に正規化する(例 "090-1234-5678" → "09012345678")。
 * 先頭 +81 / 0081 / 81 は 0 に変換。数字以外は除去。不正なら ""。
 */
export function normalizePhone(input: string): string {
  let s = toHalfWidth(input).trim();
  // 国際表記を国内へ
  s = s.replace(/^\+81/, "0").replace(/^0081/, "0");
  // 記号除去(数字のみに)
  const digits = s.replace(/[^\d]/g, "");
  if (digits === "") return "";
  // 81 始まり(+ が消えたケース)で 0 始まりでない妥当長なら 0 付与
  if (!digits.startsWith("0") && digits.startsWith("81") && digits.length >= 11) {
    return "0" + digits.slice(2);
  }
  return digits;
}

/** 電話番号の種別。 */
export type PhoneType = "mobile" | "ip" | "toll-free" | "landline" | "unknown";

/** 種別を判定する。 */
export function phoneType(input: string): PhoneType {
  const n = normalizePhone(input);
  // 0120/0800 は 080 携帯と桁数が競合するため先に判定する。
  if (/^0120\d{6}$/.test(n) || /^0800\d{7}$/.test(n)) return "toll-free";
  if (/^0[789]0\d{8}$/.test(n)) return "mobile";       // 070/080/090 + 8
  if (/^050\d{8}$/.test(n)) return "ip";               // 050 + 8
  if (/^0[1-9]\d{8}$/.test(n)) return "landline";      // 10桁(市外局番)
  return "unknown";
}

/** 日本の電話番号として妥当か。 */
export function isValidJpPhone(input: string): boolean {
  return phoneType(input) !== "unknown";
}

/** E.164(+81…)へ変換する。不正なら null。 */
export function toE164(input: string): string | null {
  const n = normalizePhone(input);
  if (!isValidJpPhone(input) || !n.startsWith("0")) return null;
  return "+81" + n.slice(1);
}

/** E.164 から国内表記の数字列へ。 */
export function fromE164(e164: string): string {
  const s = toHalfWidth(e164).replace(/[^\d+]/g, "");
  if (s.startsWith("+81")) return "0" + s.slice(3);
  if (s.startsWith("81")) return "0" + s.slice(2);
  return s;
}

/** ハイフン区切りで整形する(種別に応じたパターン。不正なら元入力)。 */
export function formatJpPhone(input: string): string {
  const n = normalizePhone(input);
  const type = phoneType(input);
  switch (type) {
    case "mobile":
    case "ip":
      return `${n.slice(0, 3)}-${n.slice(3, 7)}-${n.slice(7)}`;        // 090-1234-5678
    case "toll-free":
      return n.startsWith("0120")
        ? `${n.slice(0, 4)}-${n.slice(4, 7)}-${n.slice(7)}`             // 0120-123-456
        : `${n.slice(0, 4)}-${n.slice(4, 7)}-${n.slice(7)}`;           // 0800-123-4567
    case "landline": {
      // 市外局番の桁数は可変。主要2桁(03/06)とそれ以外3桁の一般則で近似。
      const area2 = /^0[36]/.test(n);
      return area2
        ? `${n.slice(0, 2)}-${n.slice(2, 6)}-${n.slice(6)}`            // 03-1234-5678
        : `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`;          // 045-444-1234
    }
    default:
      return input;
  }
}

/** 番号の下 n 桁だけ残してマスクする(既定 4)。 */
export function maskPhone(input: string, visible = 4): string {
  const n = normalizePhone(input);
  if (n.length <= visible) return n;
  return "*".repeat(n.length - visible) + n.slice(-visible);
}
