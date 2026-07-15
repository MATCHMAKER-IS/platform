/**
 * 日本固有のバリデーション。都道府県・カナ・法人番号・マイナンバー等。
 * @packageDocumentation
 */

/** 47 都道府県。 */
export const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県",
  "埼玉県","千葉県","東京都","神奈川県","新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県",
  "佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
] as const;

/**
 * 全角カタカナ(長音符・スペース含む)のみか。
 *
 * @param input 判定する文字列
 * @returns 全角カタカナ(と長音・空白)だけなら true
 */
export function isKatakana(s: string): boolean {
  return /^[\u30A0-\u30FF\u30FC\s\u3000]+$/.test(s);
}

/**
 * 全角ひらがな(長音符・スペース含む)のみか。
 *
 * @param input 判定する文字列
 * @returns ひらがな(と長音・空白)だけなら true
 */
export function isHiragana(s: string): boolean {
  return /^[\u3040-\u309F\u30FC\s\u3000]+$/.test(s);
}

/**
 * マイナンバー(個人番号)12 桁のチェックディジットを計算する。
 * 先頭 11 桁から 12 桁目(検査用数字)を求める。
 * @param first11 先頭 11 桁の数字文字列
 * @returns 検査用数字(0-9)
 */
export function computeMyNumberCheckDigit(first11: string): number {
  // P_n: 下位 n 桁目の数字(n=1..11)。Q_n: 1<=n<=6 は n+1、7<=n<=11 は n-5。
  let sum = 0;
  for (let n = 1; n <= 11; n++) {
    const p = Number(first11[11 - n]); // 下位から n 桁目
    const q = n <= 6 ? n + 1 : n - 5;
    sum += p * q;
  }
  const r = sum % 11;
  return r <= 1 ? 0 : 11 - r;
}

/**
 * マイナンバー(12 桁 + チェックディジット)が妥当か。
 *
 * @param input マイナンバー(12 桁)
 * @returns 桁数とチェックディジットが正しければ true。**マイナンバーはログに残さないこと**
 */
export function isValidMyNumber(s: string): boolean {
  if (!/^\d{12}$/.test(s)) return false;
  return computeMyNumberCheckDigit(s.slice(0, 11)) === Number(s[11]);
}

/**
 * 法人番号 13 桁のチェックディジット(先頭 1 桁)を計算する。
 * @param last12 チェックディジットを除く 12 桁の数字文字列
 * @returns 検査用数字(0-9)
 */
export function computeCorporateCheckDigit(last12: string): number {
  // Q_n: 下位から奇数桁は 1、偶数桁は 2。check = 9 - (Σ P_n·Q_n mod 9)
  let sum = 0;
  for (let n = 1; n <= 12; n++) {
    const p = Number(last12[12 - n]);
    const q = n % 2 === 1 ? 1 : 2;
    sum += p * q;
  }
  return 9 - (sum % 9);
}

/**
 * 法人番号(13 桁、先頭がチェックディジット)が妥当か。
 *
 * @param input 法人番号(13 桁)
 * @returns 桁数とチェックディジットが正しければ true
 */
export function isValidCorporateNumber(s: string): boolean {
  if (!/^\d{13}$/.test(s)) return false;
  return computeCorporateCheckDigit(s.slice(1)) === Number(s[0]);
}

/**
 * 半角カタカナ(ﾊﾝｶｸ)のみか。
 *
 * @param input 判定する文字列
 * @returns 半角カナが含まれていれば true(**銀行振込のデータで使う**)
 */
export function isHalfWidthKana(s: string): boolean {
  return /^[\uFF61-\uFF9F\s]+$/.test(s);
}

/**
 * クレジットカード番号の Luhn チェック。
 * @param num カード番号(空白・ハイフン可)
 * @returns 妥当なら true
 */
export function isValidCreditCard(num: string): boolean {
  const s = num.replace(/[\s-]/g, "");
  if (!/^\d{12,19}$/.test(s)) return false;
  let sum = 0;
  let alt = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = Number(s[i]);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}
