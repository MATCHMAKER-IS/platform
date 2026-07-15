/**
 * AppError のコード → HTTP ステータスの対応。
 * 各アプリで try/catch とステータス変換を再発明しないよう一元化する。
 * @packageDocumentation
 */
import { ErrorCode } from "@platform/core";

/** {@link ErrorCode} と HTTP ステータスコードの対応表。 */
export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  [ErrorCode.VALIDATION]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.EXTERNAL]: 502,
  [ErrorCode.DATABASE]: 500,
  [ErrorCode.CONFIG]: 500,
  [ErrorCode.INTERNAL]: 500,
};
