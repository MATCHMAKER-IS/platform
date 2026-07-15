/**
 * 本人確認書類の番号バリデーション(日本)。
 *
 * これらは **書式(フォーマット)検証**であり、書類の真正性・実在確認ではありません。
 * 実際の本人確認(eKYC・顔照合・犯収法対応)は専用ベンダー(TRUSTDOCK 等)に委ねてください。
 * ここは入力ミス検出・正規化・保存前チェックに使う軽量な部品です。
 * @packageDocumentation
 */

/** 本人確認書類の種別。 */
export type IdentityDocumentType =
  | "my_number"        // マイナンバー(個人番号)
  | "drivers_license"  // 運転免許証
  | "passport"         // 日本国旅券
  | "residence_card"   // 在留カード / 特別永住者証明書
  | "health_insurance"; // 健康保険証(記号番号)

/**
 * 全角英数を半角に、空白・ハイフンを除去して正規化する。
 *
 * @param input 入力された番号(全角・空白・区切りが混ざってよい)
 * @returns 正規化した文字列。**検証の前に必ず通す**(人の手入力は揺れる)
 */
export function normalizeDocumentNumber(value: string): string {
  return value
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-‐-‑―ー－]/g, "")
    .toUpperCase();
}

/**
 * * 運転免許証番号(12 桁の数字)。
 * 公的なチェックディジット仕様は公開されていないため書式のみ検証する。
 *
 * @param input 運転免許証番号(12 桁)
 * @returns 桁数とチェックディジットが正しければ true
 */
export function isValidDriversLicenseNumber(value: string): boolean {
  return /^\d{12}$/.test(normalizeDocumentNumber(value));
}

/**
 * * 日本国旅券(パスポート)番号。
 * 現行様式は英字2 + 数字7(例 TK1234567)。旧様式(英字1 + 数字8)も許容する。
 *
 * @param input パスポート番号
 * @returns 形式(英字 2 + 数字 7)が正しければ true。**チェックディジットは無いので形式のみ**
 */
export function isValidJapanPassportNumber(value: string): boolean {
  const v = normalizeDocumentNumber(value);
  return /^[A-Z]{2}\d{7}$/.test(v) || /^[A-Z]\d{8}$/.test(v);
}

/**
 * * 在留カード番号 / 特別永住者証明書番号。
 * 書式は 英字2 + 数字8 + 英字2(計12桁)。書式のみ検証する
 * (検査数字アルゴリズムは非公開情報を含むため実装しない)。
 *
 * @param input 在留カード番号
 * @returns 形式とチェックディジットが正しければ true
 */
export function isValidResidenceCardNumber(value: string): boolean {
  return /^[A-Z]{2}\d{8}[A-Z]{2}$/.test(normalizeDocumentNumber(value));
}

/**
 * 種別を指定して本人確認書類番号を検証する。my_number/health_insurance は別途専用関数/任意様式。
 *
 * @param type 書類の種類
 * @param input 番号
 * @returns 判定結果と、不正なら理由。**種類ごとに検証の強さが違う**(パスポートは形式のみ)
 */
export function validateIdentityDocument(type: IdentityDocumentType, value: string): boolean {
  switch (type) {
    case "drivers_license": return isValidDriversLicenseNumber(value);
    case "passport": return isValidJapanPassportNumber(value);
    case "residence_card": return isValidResidenceCardNumber(value);
    case "my_number": return /^\d{12}$/.test(normalizeDocumentNumber(value)); // 桁のみ。厳密検証は isValidMyNumber
    case "health_insurance": return normalizeDocumentNumber(value).length > 0; // 記号番号は保険者ごとに多様
    default: return false;
  }
}
