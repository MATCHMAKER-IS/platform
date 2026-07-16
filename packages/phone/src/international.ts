/**
 * 国際電話番号(E.164)ユーティリティ(純)。主要国の国番号を最長一致で判定する。
 * @packageDocumentation
 */

/** 国番号エントリ。 */
interface CallingCode { code: string; country: string; name: string }

// 主要国の国番号(最長一致のため長い順に並べる)。
const CALLING_CODES: CallingCode[] = [
  { code: "886", country: "TW", name: "台湾" }, { code: "852", country: "HK", name: "香港" }, { code: "853", country: "MO", name: "マカオ" },
  { code: "971", country: "AE", name: "UAE" }, { code: "966", country: "SA", name: "サウジアラビア" },
  { code: "358", country: "FI", name: "フィンランド" }, { code: "351", country: "PT", name: "ポルトガル" },
  { code: "81", country: "JP", name: "日本" }, { code: "82", country: "KR", name: "韓国" }, { code: "86", country: "CN", name: "中国" },
  { code: "84", country: "VN", name: "ベトナム" }, { code: "66", country: "TH", name: "タイ" }, { code: "65", country: "SG", name: "シンガポール" },
  { code: "60", country: "MY", name: "マレーシア" }, { code: "63", country: "PH", name: "フィリピン" }, { code: "62", country: "ID", name: "インドネシア" },
  { code: "91", country: "IN", name: "インド" }, { code: "44", country: "GB", name: "イギリス" }, { code: "49", country: "DE", name: "ドイツ" },
  { code: "33", country: "FR", name: "フランス" }, { code: "39", country: "IT", name: "イタリア" }, { code: "34", country: "ES", name: "スペイン" },
  { code: "31", country: "NL", name: "オランダ" }, { code: "41", country: "CH", name: "スイス" }, { code: "46", country: "SE", name: "スウェーデン" },
  { code: "47", country: "NO", name: "ノルウェー" }, { code: "45", country: "DK", name: "デンマーク" },
  { code: "55", country: "BR", name: "ブラジル" }, { code: "52", country: "MX", name: "メキシコ" }, { code: "54", country: "AR", name: "アルゼンチン" },
  { code: "61", country: "AU", name: "オーストラリア" }, { code: "64", country: "NZ", name: "ニュージーランド" },
  { code: "7", country: "RU", name: "ロシア" }, { code: "1", country: "US", name: "米国/カナダ" },
].sort((a, b) => b.code.length - a.code.length);

/**
 * E.164 形式として妥当かを判定する。
 *
 * **`+` と 7〜15 桁**(ITU-T の規定)。
 *
 * @param input 電話番号
 * @returns 妥当なら true
 */
export function isValidE164(input: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(input.trim());
}

/** E.164 のパース結果。 */
export interface E164Parts { e164: string; callingCode: string; country: string; nationalNumber: string }

/**
 * E.164 を解析する。
 *
 * @param e164 E.164 形式
 * @returns 国番号・国コード・国内番号。**不正なら null**
 */
export function parseE164(input: string): E164Parts | null {
  const e164 = input.trim().replace(/[\s\-()]/g, "");
  if (!isValidE164(e164)) return null;
  const digits = e164.slice(1);
  for (const cc of CALLING_CODES) {
    if (digits.startsWith(cc.code)) {
      return { e164, callingCode: cc.code, country: cc.country, nationalNumber: digits.slice(cc.code.length) };
    }
  }
  return null;
}

/**
 * E.164 から国コードを判定する。
 *
 * **US と CA は同じ国番号(+1)**なので、区別できない(US を返す)。
 * 厳密に区別するには市外局番の表が要る。
 *
 * @param e164 E.164 形式
 * @returns ISO の国コード。**不明なら null**
 */
export function detectCountry(input: string): string | null {
  return parseE164(input)?.country ?? null;
}

/**
 * 国番号と国内番号から E.164 を組み立てる。
 *
 * **先頭の 0 は自動で除去**する(日本の `090-...` は E.164 では `+8190-...`)。
 * ここを間違えると番号が届かない。
 *
 * @param countryCode 国番号(`81` など)
 * @param nationalNumber 国内番号
 * @returns E.164 形式
 */
export function toE164International(callingCode: string, nationalNumber: string): string {
  const cc = callingCode.replace(/^\+/, "").replace(/\D/g, "");
  const national = nationalNumber.replace(/\D/g, "").replace(/^0+/, "");
  return `+${cc}${national}`;
}

/** 国際番号の種別(国別ルールに基づく)。 */
export type IntlPhoneType = "mobile" | "landline" | "toll-free" | "fixed_or_mobile" | "unknown";

// 国コード → 国内番号(national significant number)から種別を返すルール。
const TYPE_RULES: Record<string, (national: string) => IntlPhoneType> = {
  JP: (n) => (/^[789]0/.test(n) ? "mobile" : /^50/.test(n) ? "mobile" : /^(120|800)/.test(n) ? "toll-free" : "landline"),
  KR: (n) => (/^10/.test(n) ? "mobile" : /^(80|1544|1566)/.test(n) ? "toll-free" : "landline"),
  CN: (n) => (/^1[3-9]/.test(n) ? "mobile" : /^(400|800)/.test(n) ? "toll-free" : "landline"),
  GB: (n) => (/^7[1-9]/.test(n) ? "mobile" : /^80/.test(n) ? "toll-free" : "landline"),
  FR: (n) => (/^[67]/.test(n) ? "mobile" : /^8/.test(n) ? "toll-free" : "landline"),
  DE: (n) => (/^1(5|6|7)/.test(n) ? "mobile" : /^800/.test(n) ? "toll-free" : "landline"),
  AU: (n) => (/^4/.test(n) ? "mobile" : /^1800/.test(n) ? "toll-free" : "landline"),
  IN: (n) => (/^[6-9]/.test(n) ? "mobile" : "landline"),
  TW: (n) => (/^9/.test(n) ? "mobile" : "landline"),
  HK: (n) => (/^[569]/.test(n) ? "mobile" : "landline"),
  US: () => "fixed_or_mobile", // NANP は番号だけでは判別不可
};

/**
 * 国際番号(E.164)の携帯/固定などの種別を判定する。
 * 国別ルールが無い場合は "unknown"、判別不能な国(米国等)は "fixed_or_mobile"。
 *
 * **国によっては携帯と固定を番号から区別できない**(米国など。番号ポータビリティで
 * 携帯番号を固定電話に移せる)。「不明」を返すのは正直な設計。
 *
 * @param input E.164 形式の電話番号
 * @returns 種別。**判別できなければ `unknown` / `fixed_or_mobile`**
 */
export function internationalPhoneType(input: string): IntlPhoneType {
  const parts = parseE164(input);
  if (!parts) return "unknown";
  const rule = TYPE_RULES[parts.country];
  return rule ? rule(parts.nationalNumber) : "unknown";
}
