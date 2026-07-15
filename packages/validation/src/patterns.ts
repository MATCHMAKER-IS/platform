/**
 * フォームレベルのバリデーションパターン(複数フィールドにまたがる検証)。
 * @packageDocumentation
 */
import { z } from "zod";

/** {@link password} の強度オプション。 */
export interface PasswordOptions {
  /** 最小文字数(既定 8)。 */
  minLength?: number;
  /** 英大文字を必須にするか(既定 true)。 */
  requireUppercase?: boolean;
  /** 英小文字を必須にするか(既定 true)。 */
  requireLowercase?: boolean;
  /** 数字を必須にするか(既定 true)。 */
  requireNumber?: boolean;
  /** 記号を必須にするか(既定 false)。 */
  requireSymbol?: boolean;
}

/**
 * パスワード強度スキーマを作る。
 * @param options 長さ・文字種の要件
 * @returns zod 文字列スキーマ
 *
 * @example
 * ```ts
 * const schema = password({ minLength: 10, requireSymbol: true });
 * ```
 */
export function password(options: PasswordOptions = {}): z.ZodString {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSymbol = false,
  } = options;
  let schema = z.string().min(minLength, `${minLength}文字以上で入力してください`);
  if (requireUppercase) schema = schema.regex(/[A-Z]/, "英大文字を含めてください");
  if (requireLowercase) schema = schema.regex(/[a-z]/, "英小文字を含めてください");
  if (requireNumber) schema = schema.regex(/[0-9]/, "数字を含めてください");
  if (requireSymbol) schema = schema.regex(/[^A-Za-z0-9]/, "記号を含めてください");
  return schema;
}

/**
 * パスワードと確認用パスワードの一致を検証するスキーマを作る。
 * @param pwd 使用するパスワードスキーマ(既定は {@link password}())
 * @returns `{ password, confirmPassword }` を検証する object スキーマ
 *
 * @example
 * ```ts
 * const schema = passwordWithConfirm();
 * // { password, confirmPassword } を検証。不一致なら confirmPassword にエラー。
 * ```
 */
export function passwordWithConfirm(pwd: z.ZodString = password()) {
  return z
    .object({ password: pwd, confirmPassword: z.string() })
    .refine((v) => v.password === v.confirmPassword, {
      message: "パスワードが一致しません",
      path: ["confirmPassword"],
    });
}

/**
 * 開始日 ≤ 終了日 を検証する日付範囲スキーマを作る。
 * @returns `{ start, end }`(ISO 日付文字列)を検証する object スキーマ
 *
 * @example
 * ```ts
 * const schema = dateRange();
 * schema.parse({ start: "2026-01-01", end: "2026-01-31" }); // OK
 * ```
 */
export function dateRange() {
  return z
    .object({ start: z.string(), end: z.string() })
    .refine((v) => Date.parse(v.start) <= Date.parse(v.end), {
      message: "終了日は開始日以降にしてください",
      path: ["end"],
    });
}

/**
 * * 数値の範囲(min ≤ x ≤ max)スキーマを作る。
 * @param min 最小値
 * @param max 最大値
 *
 * @returns 範囲内(両端を含む)なら true
 */
export function between(min: number, max: number): z.ZodNumber {
  return z.number().min(min, `${min}以上で入力してください`).max(max, `${max}以下で入力してください`);
}

/** 未来日(今日より後)を要求するスキーマ。ISO 日付文字列を受ける。 */
export function futureDate() {
  return z.string().refine((s) => Date.parse(s) > Date.now(), "未来の日付を入力してください");
}

/** 過去日(今日より前)を要求するスキーマ。ISO 日付文字列を受ける。 */
export function pastDate() {
  return z.string().refine((s) => Date.parse(s) < Date.now(), "過去の日付を入力してください");
}

/**
 * 1 件以上の配列(空配列不可)スキーマを作る。
 * @param item 要素スキーマ
 * @param message 空のときのメッセージ
 */
export function nonEmptyArray<T extends z.ZodTypeAny>(item: T, message = "1件以上選択してください") {
  return z.array(item).min(1, message);
}

/** {@link fileConstraints} のオプション。 */
export interface FileConstraintOptions {
  /** 最大バイト数。 */
  maxSizeBytes?: number;
  /** 許可する MIME タイプ(前方一致可、例: "image/")。 */
  allowedMimeTypes?: string[];
}

/**
 * アップロードファイルの検証スキーマを作る(`{ size, type }` を持つ値を検証)。
 * ブラウザ File / サーバ側メタデータ双方に使える最小形。
 * @param options 最大サイズ・許可 MIME
 *
 * @example
 * ```ts
 * const schema = fileConstraints({ maxSizeBytes: 5_000_000, allowedMimeTypes: ["image/"] });
 * schema.parse({ size: file.size, type: file.type });
 * ```
 */
export function fileConstraints(options: FileConstraintOptions = {}) {
  const { maxSizeBytes, allowedMimeTypes } = options;
  return z.object({ size: z.number().nonnegative(), type: z.string() }).superRefine((file, ctx) => {
    if (maxSizeBytes != null && file.size > maxSizeBytes) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `ファイルサイズは${Math.floor(maxSizeBytes / 1024 / 1024)}MB以下にしてください`, path: ["size"] });
    }
    if (allowedMimeTypes && !allowedMimeTypes.some((t) => file.type.startsWith(t))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "許可されていないファイル形式です", path: ["type"] });
    }
  });
}
