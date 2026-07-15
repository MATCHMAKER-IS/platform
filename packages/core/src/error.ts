/**
 * 全基盤パッケージで共通のエラー表現。
 *
 * どのパッケージで失敗しても「同じ形」でエラーが返ることを保証し、
 * デバッグ・ログ・アプリ側でのハンドリングを一貫させる。
 *
 * @packageDocumentation
 */

/**
 * 基盤全体で使うエラーコードの一覧。
 * パッケージ横断で意味が変わらないよう、ここで一元管理する。
 */
export const ErrorCode = {
  /** 入力値のバリデーション失敗 */
  VALIDATION: "VALIDATION",
  /** 対象が見つからない */
  NOT_FOUND: "NOT_FOUND",
  /** 認証が必要 / 失敗 */
  UNAUTHORIZED: "UNAUTHORIZED",
  /** 権限が無い */
  FORBIDDEN: "FORBIDDEN",
  /** レート制限超過 */
  RATE_LIMITED: "RATE_LIMITED",
  /** 一意制約違反などの競合 */
  CONFLICT: "CONFLICT",
  /** 外部サービス連携での失敗(メール送信、API 呼び出し等) */
  EXTERNAL: "EXTERNAL",
  /** データベース操作の失敗 */
  DATABASE: "DATABASE",
  /** 設定・環境変数の不備 */
  CONFIG: "CONFIG",
  /** 想定外の内部エラー */
  INTERNAL: "INTERNAL",
} as const;

/** {@link ErrorCode} のいずれかの値。 */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * 基盤共通のアプリケーションエラー。
 *
 * 素の `Error` を投げる代わりにこれを使うことで、
 * コード・利用者向けメッセージ・原因(cause)・付随情報(details)を
 * 構造化して持ち回れる。
 *
 * @example
 * ```ts
 * throw new AppError(ErrorCode.NOT_FOUND, "ユーザーが見つかりません", {
 *   details: { userId },
 * });
 * ```
 */
export class AppError extends Error {
  /** 機械可読なエラー種別。 */
  public readonly code: ErrorCode;
  /** ログ等に残す任意の付随情報(個人情報は入れない)。 */
  public readonly details?: Record<string, unknown>;

  /**
   * @param code    エラー種別({@link ErrorCode})
   * @param message 人間可読なメッセージ
   * @param options `cause`(元例外)と `details`(付随情報)
   */
  constructor(
    code: ErrorCode,
    message: string,
    options?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.details = options?.details;
  }

  /**
   * 任意の値を {@link AppError} に正規化する。
   * try/catch で受けた `unknown` を安全に扱うためのヘルパー。
   *
   * @param err       catch した値
   * @param fallback  AppError でなかった場合に付与するコード(既定: INTERNAL)
   * @returns 正規化された {@link AppError}
   */
  static from(err: unknown, fallback: ErrorCode = ErrorCode.INTERNAL): AppError {
    if (err instanceof AppError) return err;
    if (err instanceof Error) {
      return new AppError(fallback, err.message, { cause: err });
    }
    return new AppError(fallback, "不明なエラーが発生しました", { cause: err });
  }

  /** ログ出力用のプレーンオブジェクトに変換する。 */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
