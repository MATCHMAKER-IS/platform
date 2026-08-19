/**
 * AppError のコード → HTTP ステータスの対応。
 *
 * **表を持たず `@platform/core` の `ERROR_POLICY` から引く。**
 *
 * 2026-08 まではここに独自の対応表があり、**`DATABASE` が 500、core 側は 503**
 * と食い違っていた。同じ `AppError(DATABASE)` が、`toHttpError` を通ると 500、
 * `httpStatusFor` を通ると 503 になる状態だった。
 * 503 には「一時的な障害なので後で再試行してよい」という意味があり、
 * 500 だと呼び出し側・ロードバランサ・監視のいずれも再試行の判断ができない。
 *
 * `ERROR_POLICY` は自ら「唯一の情報源」と宣言している。**表を二つ持たない。**
 * 再試行可否(`retryable`)も同じ表にあるので、片方だけ直して不整合になることも防げる。
 *
 * @packageDocumentation
 */
import { ERROR_POLICY, type ErrorCode } from "@platform/core";

/**
 * {@link ErrorCode} と HTTP ステータスコードの対応表。
 *
 * `ERROR_POLICY` から導出しているので、**core を直せばここも変わる**。
 */
export const STATUS_BY_CODE: Record<ErrorCode, number> = Object.fromEntries(
  Object.entries(ERROR_POLICY).map(([code, policy]) => [code, policy.httpStatus]),
) as Record<ErrorCode, number>;
