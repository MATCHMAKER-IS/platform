/**
 * Prisma のエラーを基盤共通の AppError に変換する。
 * 各アプリで P2002 等のコード分岐を再発明しないよう一元化する。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";

interface PrismaKnownError {
  name?: string;
  code?: string;
  meta?: { target?: string[] | string; field_name?: string };
  message?: string;
}

/** Prisma の既知エラーか(構造で判定、@prisma/client に依存しない)。 */
function isPrismaKnownError(e: unknown): e is PrismaKnownError {
  return typeof e === "object" && e !== null && typeof (e as { code?: unknown }).code === "string";
}

/**
 * Prisma のエラーを {@link @platform/core#AppError} に変換する。
 * - P2002 一意制約 → `CONFLICT`(409)
 * - P2025 対象なし → `NOT_FOUND`(404)
 * - P2003 外部キー → `VALIDATION`(400)
 * - P2034 書き込み競合/デッドロック → `CONFLICT`(409、{@link isRetryablePrismaError} が true)
 * - その他 → `DATABASE`(500)
 */
export function mapPrismaError(e: unknown): AppError {
  if (isPrismaKnownError(e)) {
    const target = Array.isArray(e.meta?.target) ? e.meta?.target.join(", ") : e.meta?.target;
    switch (e.code) {
      case "P2002":
        return new AppError(ErrorCode.CONFLICT, `既に登録されています${target ? `(${target})` : ""}`, { cause: e, details: { target } });
      case "P2025":
        return new AppError(ErrorCode.NOT_FOUND, "対象のレコードが見つかりません", { cause: e });
      case "P2003":
        return new AppError(ErrorCode.VALIDATION, "関連するデータが存在しません(外部キー制約)", { cause: e });
      case "P2034":
        return new AppError(ErrorCode.CONFLICT, "書き込みが競合しました。再試行してください。", { cause: e });
      default:
        return new AppError(ErrorCode.DATABASE, "データベース操作に失敗しました", { cause: e, details: { code: e.code } });
    }
  }
  return AppError.from(e, ErrorCode.DATABASE);
}

/** 再試行で回復しうる Prisma エラーか(デッドロック・シリアライズ失敗)。 */
export function isRetryablePrismaError(e: unknown): boolean {
  if (isPrismaKnownError(e)) return e.code === "P2034";
  // 生 SQL の場合のシリアライズ/デッドロック(SQLSTATE 40001/40P01)
  const msg = (e as { message?: string })?.message ?? "";
  return /40001|40P01|deadlock|serialization/i.test(msg);
}
