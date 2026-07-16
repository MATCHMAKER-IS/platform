/**
 * エラー分類の中央管理。ErrorCode ごとに「HTTP ステータス」「再試行可否」を1か所で定義し、
 * リトライ層・ルート層・クライアントが同じ判断基準を共有する。
 * 判定ロジックの散在(各所の shouldRetry / status 直書き)を解消する。
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "./error";

/** 各 ErrorCode のポリシー。 */
export interface ErrorPolicy {
  /** 対応する HTTP ステータスコード。 */
  httpStatus: number;
  /** 一時的(再試行で回復しうる)か。true=transient。 */
  retryable: boolean;
}

/** ErrorCode → ポリシーの対応表(唯一の情報源)。 */
export const ERROR_POLICY: Record<ErrorCode, ErrorPolicy> = {
  VALIDATION: { httpStatus: 400, retryable: false },
  NOT_FOUND: { httpStatus: 404, retryable: false },
  UNAUTHORIZED: { httpStatus: 401, retryable: false },
  FORBIDDEN: { httpStatus: 403, retryable: false },
  RATE_LIMITED: { httpStatus: 429, retryable: true }, // 待てば回復
  CONFLICT: { httpStatus: 409, retryable: false },
  EXTERNAL: { httpStatus: 502, retryable: true }, // 外部の一時障害
  DATABASE: { httpStatus: 503, retryable: true }, // 接続断・デッドロック等
  CONFIG: { httpStatus: 500, retryable: false },
  INTERNAL: { httpStatus: 500, retryable: false },
};

/**
 * エラーに対応する HTTP ステータスを返す。
 *
 * `AppError` のコードから引く。それ以外(生の Error など)は分類できないため 500 にする。
 *
 * @param error 任意のエラー値(AppError でなくてもよい)
 * @returns HTTP ステータスコード(400 / 404 / 500 など)
 *
 * @example
 * ```ts
 * httpStatusFor(new AppError(ErrorCode.VALIDATION, "不正"));  // => 400
 * httpStatusFor(new Error("不明"));                            // => 500
 * ```
 */
export function httpStatusFor(error: unknown): number {
  if (error instanceof AppError) return ERROR_POLICY[error.code].httpStatus;
  return 500;
}

/**
 * 再試行すべきエラーかを中央基準で判定する。
 *
 * 各リトライ層(notify / storage / db / zoho 等)の `shouldRetry` にこれを渡せば、
 * 「どのエラーなら再試行してよいか」の分類がリポジトリ全体で統一される。
 *
 * @param error 任意のエラー値
 * @returns 再試行する価値があるなら true(ネットワーク断・503 など)
 *
 * @example
 * ```ts
 * withRetry(fn, { shouldRetry: isRetryable });
 * ```
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) return ERROR_POLICY[error.code].retryable;
  return false; // 未分類は再試行しない(安全側)
}

/**
 * 既知の恒久エラー(再試行しても無駄なもの)かを判定する。
 *
 * `AppError` かつ `retryable=false` のときだけ true。
 * 生の Error など「分類できないもの」は false(=恒久と断定しない)。
 * **迷ったら再試行させる**という安全側の設計。
 *
 * @param error 任意のエラー値
 * @returns 再試行しても無駄だと分かっているなら true
 */
export function isPermanent(error: unknown): boolean {
  return error instanceof AppError && !ERROR_POLICY[error.code].retryable;
}

/**
 * リトライ層の既定 shouldRetry。既知の恒久エラー(VALIDATION/FORBIDDEN 等)だけ再試行を止め、
 * 一時エラー(EXTERNAL/DATABASE/RATE_LIMITED)と分類不能な生エラー(ネットワーク瞬断等)は再試行する。
 * 各層(notify/storage/mail/sms)がこれを既定にすることで、無駄な再試行を一斉に排除できる。
 *
 * @param error 任意のエラー値
 * @returns 再試行してよいなら true(既知の恒久エラーだけ false)
 */
export function defaultShouldRetry(error: unknown): boolean {
  return !isPermanent(error);
}

/** クライアントへ返す標準エラーエンベロープ。 */
export interface ErrorEnvelope {
  error: {
    code: ErrorCode | "UNKNOWN";
    message: string;
    /** 相関 ID(サポート・調査用。ログ/トレースと突合)。 */
    traceId?: string;
    /** 付随情報(個人情報を含めないこと)。 */
    details?: Record<string, unknown>;
  };
}

/**
 * エラーを標準エンベロープに変換する。API レスポンス生成に使う。
 *
 * **内部の詳細は漏らさない**: AppError 以外は「予期しないエラー」に丸める
 * (スタックトレースや内部メッセージを外に出さないため)。
 *
 * @param error   任意のエラー値
 * @param traceId 相関 ID(あれば付与。障害調査でログと突合するため)
 * @returns `{ error: { code, message, traceId? } }` 形式のエンベロープ
 *
 * @example
 * ```ts
 * return Response.json(toErrorEnvelope(e, span.traceId), { status: httpStatusFor(e) });
 * ```
 */
export function toErrorEnvelope(error: unknown, traceId?: string): ErrorEnvelope {
  if (error instanceof AppError) {
    return { error: { code: error.code, message: error.message, ...(traceId ? { traceId } : {}), ...(error.details ? { details: error.details } : {}) } };
  }
  return { error: { code: "UNKNOWN", message: "予期しないエラーが発生しました", ...(traceId ? { traceId } : {}) } };
}
