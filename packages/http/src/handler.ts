/**
 * Route Handler / Server Action 共通のエラーハンドリング。
 *
 * ハンドラ内で AppError を throw すれば、ここで適切な HTTP ステータスと
 * JSON ボディに変換する。500 系は詳細を隠し、ログ用途は呼び出し側で行う。
 *
 * @packageDocumentation
 */
import { AppError, type Result } from "@platform/core";
import { getRequestId } from "@platform/context";
import { STATUS_BY_CODE } from "./status";
import { toUserMessage } from "./user-message";

/** クライアントに返すエラーボディの形。 */
export interface HttpErrorBody {
  error: {
    code: string;
    /**
     * 開発者向けの説明。
     *
     * **これを画面にそのまま出さないでください。**
     * 「zod validation failed」「P2002 unique constraint」のような、
     * **利用者には意味の分からない文言**が入ります。
     * 画面には後述の `userMessage` を使ってください。
     */
    message: string;
    /**
     * **利用者にそのまま見せてよい文言。**
     *
     * 専門用語を使わず、**次に何をすればよいか**まで書いてあります
     * （{@link toUserMessage} が作ります）。
     *
     * `recoverable` が false のときは、**「もう一度試す」ボタンを出さないこと**——
     * 何度押しても直らないボタンは、不信につながります。
     */
    userMessage: { title: string; action: string; recoverable: boolean };
    /** 相関 ID(コンテキスト内でのみ付く)。**ログとの突き合わせに使う**。 */
    traceId?: string;
  };
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
  // **利用者向けの文言も一緒に返す。**
  //
  // 400 系は `app.message` がそのまま出ていた——開発者が書いた文言なので、
  // **「不正な要求です」「バリデーションエラー」**のように、
  // **何をすればよいか分からない**ものが画面に出ていた(2026-08)。
  //
  // `message` は残す(既存の呼び出し元・ログのため)。**画面は `userMessage` を見る**。
  return { status, body: { error: { code: app.code, message, userMessage: toUserMessage(error) } } };
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
      // **相関 ID を返す。** 利用者が「エラーが出た」と言ってきたときに、
      // ログのどの行かを突き合わせるための唯一の手がかり。
      //
      // 2026-08 まで付けていなかった。同じことをするラッパーが 4 段階あり
      // (`handleRoute` / `withApi`(雛形) / `withApiObservability`(社内アプリ) / 何も無い)、
      // **基盤自身のこれだけが traceId を落としていた**。
      // 呼び出し側は「基盤の作法どおりに書いた」つもりで、追跡できない応答を返していた。
      //
      // コンテキストの外(バッチ・起動時)では `undefined` になるだけで、何も壊れない。
      const traceId = getRequestId();
      return Response.json(traceId === undefined ? body : { ...body, error: { ...body.error, traceId } },
        { status, ...(traceId === undefined ? {} : { headers: { "x-request-id": traceId } }) });
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
