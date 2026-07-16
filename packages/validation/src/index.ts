/**
 * `@platform/validation` — 共通バリデーション部品。
 *
 * 内部実装は zod。よく使うスキーマ(日本固有含む)・正規化・フォームパターンを
 * 集約し、重複と表記ゆれを防ぐ。検証結果は基盤共通の {@link @platform/core#Result}
 * で返す `validate` も提供する。
 *
 * @packageDocumentation
 */
import { z } from "zod";
import { AppError, ErrorCode, ok, err, type Result } from "@platform/core";

/**
 * 任意の zod スキーマで値を検証し、Result で返す。
 * @typeParam T zod スキーマの型
 * @param schema 検証スキーマ
 * @param input  検証する値
 * @returns 成功なら型付き `ok`、失敗なら `VALIDATION` の `err`(issues 付き)
 *
 * @example
 * ```ts
 * const res = validate(z.object({ email }), body);
 * if (!res.ok) return badRequest(res.error);
 * ```
 */
export function validate<T extends z.ZodTypeAny>(schema: T, input: unknown): Result<z.infer<T>> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return err(
    new AppError(ErrorCode.VALIDATION, "入力値が正しくありません", {
      details: {
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    }),
  );
}

// よく使うスキーマ
export {
  requiredString, optionalString, email, url,
  zipCodeJp, phoneJp, mobileJp, katakana, hiragana, prefecture,
  myNumber, corporateNumber, positiveInt, amount, percentage, uuid, agreement, dateString,
  alphanumeric, halfWidthKana, time, httpsUrl, creditCard, bankCode, branchCode, accountNumber,
} from "./schemas";

// 日本固有ヘルパー・定数
export {
  PREFECTURES, isKatakana, isHiragana,
  isValidMyNumber, isValidCorporateNumber,
  computeMyNumberCheckDigit, computeCorporateCheckDigit,
  isHalfWidthKana, isValidCreditCard,
} from "./japan";

// 正規化
export { toHalfWidth, digitsToHalfWidth, normalizeSpace } from "./transforms";

// フォームパターン
export {
  password, passwordWithConfirm, dateRange,
  between, futureDate, pastDate, nonEmptyArray, fileConstraints,
  type PasswordOptions, type FileConstraintOptions,
} from "./patterns";

export { z };

export * from "./jp";
export * from "./identity";
