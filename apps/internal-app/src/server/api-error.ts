/**
 * API エラーレスポンスの標準化。任意のエラーを {@link toErrorEnvelope} に変換し、
 * {@link httpStatusFor} で正しい HTTP ステータスを付けて返す。traceId を相関コンテキストから補う。
 * これで全ルートのエラー応答形が統一され、クライアントは code で分岐でき、traceId で調査できる。
 * @packageDocumentation
 */
import { AppError, ErrorCode, httpStatusFor, toErrorEnvelope } from "@platform/core";
import { logContext } from "./log-context";

/** エラーを標準エンベロープ + 正しいステータスの Response にする。 */
export function errorResponse(error: unknown): Response {
  const traceId = (logContext.get() as { traceId?: string }).traceId;
  const envelope = toErrorEnvelope(error, traceId);
  return Response.json(envelope, { status: httpStatusFor(error) });
}

/** AppError を投げるショートハンド(ルート内の検証で使う)。 */
export function fail(code: ErrorCode, message: string, details?: Record<string, unknown>): never {
  throw new AppError(code, message, details ? { details } : undefined);
}
