/**
 * Route Handler / Server Action 共通のエラーハンドリング。
 *
 * ハンドラ内で AppError を throw すれば、ここで適切な HTTP ステータスと
 * JSON ボディに変換する。500 系は詳細を隠し、ログ用途は呼び出し側で行う。
 *
 * @packageDocumentation
 */
import { AppError, type Result } from "@platform/core";
import { STATUS_BY_CODE } from "./status";

/** クライアントに返すエラーボディの形。 */
export interface HttpErrorBody {
  error: { code: string; message: string };
}

/**
 * AppError を HTTP ステータスとレスポンスボディに変換する。
 * @param error AppError(または任意の値。正規化される)
 * @returns `{ status, body }`
 */
export function toHttpError(error: unknown): { status: number; body: HttpErrorBody } {
  const app = AppError.from(error);
  const status = STATUS_BY_CODE[app.code] ?? 500;
  // 500 系は内部詳細を露出しない
  const message = status >= 500 ? "サーバー内部エラーが発生しました" : app.message;
  return { status, body: { error: { code: app.code, message } } };
}

/**
 * Next.js の Route Handler をラップし、throw された AppError を
 * 自動的に JSON レスポンスへ変換する。
 *
 * @typeParam A ハンドラの引数(context 等)
 * @param handler `Response` を返す非同期ハンドラ
 * @returns ラップされたハンドラ
 *
 * @example
 * ```ts
 * export const POST = handleRoute(async (req) => {
 *   const body = await req.json();
 *   const parsed = validate(schema, body);
 *   if (!parsed.ok) throw parsed.error; // 400 になる
 *   return Response.json({ ok: true });
 * });
 * ```
 */
export function handleRoute<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (e) {
      const { status, body } = toHttpError(e);
      return Response.json(body, { status });
    }
  };
}

/**
 * `Result` を HTTP レスポンスに変換する。
 * 成功なら 200 で `value` を、失敗なら対応ステータスでエラーボディを返す。
 *
 * @param result 変換する {@link @platform/core#Result}
 * @param okStatus 成功時のステータス(既定: 200)
 * @returns Response
 */
export function resultToResponse<T>(result: Result<T>, okStatus = 200): Response {
  if (result.ok) return Response.json(result.value, { status: okStatus });
  const { status, body } = toHttpError(result.error);
  return Response.json(body, { status });
}
