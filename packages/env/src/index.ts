/**
 * `@platform/env` — 環境変数の起動時検証(fail-fast)。
 *
 * `process.env` を各所で直接読むのを禁止し、起動時に一度だけ
 * zod スキーマで検証する。必須値が欠けていれば **即座に起動失敗** させ、
 * 実行時の「undefined 由来の謎バグ」を防ぐ。
 *
 * @packageDocumentation
 */

import { z } from "zod";
import { AppError, ErrorCode } from "@platform/core";

/**
 * 与えた zod スキーマで環境変数を検証し、型付きの設定オブジェクトを返す。
 *
 * @typeParam T zod スキーマの型
 * @param schema 期待する環境変数のスキーマ
 * @param source 検証対象(既定: `process.env`)。テスト時は任意の object を渡せる。
 * @returns 検証済み・型付きの環境変数
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 検証に失敗した場合
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * export const env = parseEnv(z.object({
 *   DATABASE_URL: z.string().url(),
 *   LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
 * }));
 * ```
 */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, unknown> = process.env,
): z.infer<T> {
  // **空文字は「未設定」として扱う。**
  // `.env` に `SMTP_PASS=` と書くと値は `undefined` ではなく空文字になり、
  // `z.string()` はそれを通す——**「設定した」つもりで空のまま本番へ出る**。
  // `.env.example` は空で配られるので、**コピーしただけの状態がこれ**。
  // SMTP なら空パスワードで認証に失敗するが、検証は成功しているので
  // 「設定漏れ」には見えず、原因を探すのに時間がかかる。
  //
  // undefined に寄せると、必須(`z.string()`)は落ち、
  // 任意(`.optional()` / `.default()`)は既定どおりに動く。
  // **既存のスキーマを変えずに効く**のが利点。
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "string" && v.trim() === "") continue;
    cleaned[k] = v;
  }
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    // **どの変数がどう駄目かをメッセージ本体に書く。**
    // `details` に入れるだけだと、Next の起動時エラーでは
    // `details: { issues: [Object, Object] }` と潰れて表示され、
    // **何を設定すればよいか分からない**(2026-08 に実際に詰まった)。
    // 起動を止める種類のエラーは、その場で直せる情報を出す。
    const summary = issues.map((i) => `${i.path}: ${i.message}`).join(" / ");
    throw new AppError(ErrorCode.CONFIG, `環境変数の検証に失敗しました — ${summary}`, {
      details: { issues },
    });
  }
  return result.data;
}

export { z };

export {
  describeEnv,
  maskSecrets,
  renderEnvExample,
  requireEnv,
  isProductionRuntime,
  appEnv,
  isDevEnv,
  isStagingEnv,
  appEnvLabel,
  isProductionEnv,
  type AppEnv,
  isBuildPhase,
  requiredAtRuntime,
  optionalEnv,
  isSecretName,
  checkSecretStrength,
  assertSecretStrength,
  type EnvVarInfo,
  type SecretIssue,
} from "./describe";
