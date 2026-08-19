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
 *
 * @param e Prisma のエラー
 * @returns {@link @platform/core#AppError} に正規化したエラー(**Prisma のエラーコードをアプリの語彙に翻訳する**。
 *   `P2002` では何のことか分からない)
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
        // **`statement_timeout` による打ち切りを DATABASE に丸めない。**
        // `createDb` は既定 30 秒で打ち切る(遅いクエリが接続を占有しないため)。
        // 丸めると `isRetryable` が true になり(DATABASE は retryable)、
        // **30 秒かかるクエリを何度も投げ直す**——DB をさらに苦しめる。
        // 打ち切りは「そのクエリが重すぎる」ことの表れで、再試行しても同じ。
        if (isStatementTimeout(e)) {
          return new AppError(
            ErrorCode.VALIDATION,
            "処理に時間がかかりすぎたため中止しました。絞り込み条件を狭めてください。",
            { cause: e, details: { code: "57014" } },
          );
        }
        return new AppError(ErrorCode.DATABASE, "データベース操作に失敗しました", { cause: e, details: { code: e.code } });
    }
  }
  if (isStatementTimeout(e)) {
    return new AppError(
      ErrorCode.VALIDATION,
      "処理に時間がかかりすぎたため中止しました。絞り込み条件を狭めてください。",
      { cause: e, details: { code: "57014" } },
    );
  }
  return AppError.from(e, ErrorCode.DATABASE);
}

/**
 * `statement_timeout` で打ち切られたか(PostgreSQL の SQLSTATE `57014`)。
 *
 * **再試行してはいけない失敗**である。時間切れは「そのクエリが重い」ことの表れで、
 * 投げ直しても同じだけ待たされる。`ErrorCode.DATABASE` に丸めると
 * `isRetryable` が true になり、**30 秒 × リトライ回数**を DB に押し付ける。
 *
 * @param e エラー
 * @returns 時間切れなら true
 */
export function isStatementTimeout(e: unknown): boolean {
  if (isPrismaKnownError(e) && e.code === "P2024") return true; // プール取得の時間切れ
  const code = (e as { code?: unknown })?.code;
  if (code === "57014") return true;
  const msg = (e as { message?: string })?.message ?? "";
  return /57014|canceling statement due to statement timeout|query_canceled/i.test(msg);
}

/**
 * 再試行で回復しうる Prisma エラーか(デッドロック・シリアライズ失敗)。
 *
 *
 * @param e エラー
 * @returns 再試行で回復しうるなら true(**デッドロック・シリアライズ失敗**)。
 *   一意制約違反などは再試行しても無駄
 */
export function isRetryablePrismaError(e: unknown): boolean {
  // **時間切れは再試行しない。** 同じクエリは同じだけ時間がかかる。
  if (isStatementTimeout(e)) return false;
  if (isPrismaKnownError(e)) return e.code === "P2034";
  // 生 SQL の場合のシリアライズ/デッドロック(SQLSTATE 40001/40P01)
  const msg = (e as { message?: string })?.message ?? "";
  return /40001|40P01|deadlock|serialization/i.test(msg);
}
