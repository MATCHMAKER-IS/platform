/**
 * よく使うバリデーションスキーマ集(zod)。
 * 日本の業務アプリで頻出する項目を、統一されたエラーメッセージで提供する。
 * @packageDocumentation
 */
import { z } from "zod";
import { digitsToHalfWidth } from "./transforms";
import { PREFECTURES, isKatakana, isHiragana, isValidMyNumber, isValidCorporateNumber, isValidCreditCard } from "./japan";

// ---- 文字列 ----

/** 必須文字列(前後トリム、空文字不可)。 */
export const requiredString = (message = "必須項目です") =>
  z.string().trim().min(1, message);

/** 任意文字列(空文字は undefined 扱い)。 */
export const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

/** メールアドレス。 */
export const email = z.string().trim().email("メールアドレスの形式が正しくありません");

/** URL。 */
export const url = z.string().trim().url("URLの形式が正しくありません");

// ---- 日本固有 ----

/** 郵便番号(123-4567 または 1234567、全角数字も受理)。 */
export const zipCodeJp = z.preprocess(
  (v) => (typeof v === "string" ? digitsToHalfWidth(v).trim() : v),
  z.string().regex(/^\d{3}-?\d{4}$/, "郵便番号の形式が正しくありません"),
);

/** 固定・携帯を問わない電話番号(全角数字も受理)。 */
export const phoneJp = z.preprocess(
  (v) => (typeof v === "string" ? digitsToHalfWidth(v).trim() : v),
  z.string().regex(/^0\d{1,4}-?\d{1,4}-?\d{3,4}$/, "電話番号の形式が正しくありません"),
);

/** 携帯電話番号(070/080/090)。 */
export const mobileJp = z.preprocess(
  (v) => (typeof v === "string" ? digitsToHalfWidth(v).trim() : v),
  z.string().regex(/^0[789]0-?\d{4}-?\d{4}$/, "携帯電話番号の形式が正しくありません"),
);

/** 全角カタカナ(ふりがな用)。 */
export const katakana = z.string().trim().refine(isKatakana, "全角カタカナで入力してください");

/** 全角ひらがな(ふりがな用)。 */
export const hiragana = z.string().trim().refine(isHiragana, "全角ひらがなで入力してください");

/** 都道府県(47 のいずれか)。 */
export const prefecture = z.enum(PREFECTURES);

/** マイナンバー(12 桁 + チェックディジット検証)。 */
export const myNumber = z.preprocess(
  (v) => (typeof v === "string" ? digitsToHalfWidth(v).replace(/[-\s]/g, "") : v),
  z.string().refine(isValidMyNumber, "マイナンバーが正しくありません"),
);

/** 法人番号(13 桁 + チェックディジット検証)。 */
export const corporateNumber = z.preprocess(
  (v) => (typeof v === "string" ? digitsToHalfWidth(v).replace(/[-\s]/g, "") : v),
  z.string().refine(isValidCorporateNumber, "法人番号が正しくありません"),
);

// ---- 数値 ----

/** 正の整数。 */
export const positiveInt = z.number().int("整数で入力してください").positive("正の数を入力してください");

/** 金額(0 以上の整数、円想定)。 */
export const amount = z.number().int("金額は整数で入力してください").nonnegative("0以上で入力してください");

/** 割合(0〜100)。 */
export const percentage = z.number().min(0, "0以上で入力してください").max(100, "100以下で入力してください");

// ---- その他 ----

/** UUID。 */
export const uuid = z.string().uuid("IDの形式が正しくありません");

/** 同意チェック(true 必須)。利用規約の同意などに。 */
export const agreement = z.boolean().refine((v) => v === true, "同意が必要です");

/** ISO 日付文字列(YYYY-MM-DD 等、Date として解釈可能)。 */
export const dateString = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "日付の形式が正しくありません");

// ---- 追加パターン ----

/** 半角英数字のみ。 */
export const alphanumeric = z.string().regex(/^[A-Za-z0-9]+$/, "半角英数字で入力してください");

/** 半角カタカナ。 */
export const halfWidthKana = z.string().trim().refine(
  (s) => /^[\uFF61-\uFF9F\s]+$/.test(s),
  "半角カタカナで入力してください",
);

/** 時刻(HH:mm、24 時間表記)。 */
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時刻は HH:mm 形式で入力してください");

/** https の URL のみ許可。 */
export const httpsUrl = z.string().trim().url("URLの形式が正しくありません").refine(
  (u) => u.startsWith("https://"),
  "https:// で始まる URL を入力してください",
);

/** クレジットカード番号(Luhn チェック、空白・ハイフン可)。 */
export const creditCard = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/[\s-]/g, "") : v),
  z.string().refine(isValidCreditCard, "カード番号が正しくありません"),
);

/** 銀行コード(4 桁)。 */
export const bankCode = z.string().regex(/^\d{4}$/, "銀行コードは4桁の数字です");

/** 支店コード(3 桁)。 */
export const branchCode = z.string().regex(/^\d{3}$/, "支店コードは3桁の数字です");

/** 口座番号(7 桁、ゼロ埋め想定)。 */
export const accountNumber = z.string().regex(/^\d{7}$/, "口座番号は7桁の数字です");
