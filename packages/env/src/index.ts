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
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new AppError(ErrorCode.CONFIG, "環境変数の検証に失敗しました", {
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
  optionalEnv,
  isSecretName,
  checkSecretStrength,
  assertSecretStrength,
  type EnvVarInfo,
  type SecretIssue,
} from "./describe";
