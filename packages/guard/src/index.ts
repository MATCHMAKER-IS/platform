/**
 * `@platform/guard` — ルート/ページ保護の共通ガード。
 *
 * セッション(`@platform/session`)・RBAC(`@platform/auth`)・レート制限
 * (`@platform/ratelimit`)を束ね、Route ハンドラの入口で「認証必須」「権限必須」
 * 「試行回数制限」を宣言的に強制する。失敗は AppError で投げ、`@platform/http` の
 * `handleRoute` が適切な HTTP ステータス(401/403/429)に変換する。
 *
 * @packageDocumentation
 */
import { AppError, ErrorCode } from "@platform/core";
import type { Session } from "@platform/session";
import { assertCan, type AuthUser, type Policy, type Permission } from "@platform/auth";
import type { RateLimiter, RateLimitResult } from "@platform/ratelimit";

/**
 * セッションを必須にする。無ければ 401(UNAUTHORIZED)。
 * @param cookieHeader `req.headers.get("cookie")`
 * @param session `@platform/session` の `createSession` で作ったもの
 * @returns セッションデータ
 * @throws {@link @platform/core#AppError} `UNAUTHORIZED`
 */
export function requireSession<T>(cookieHeader: string | null | undefined, session: Session<T>): T {
  const data = session.read(cookieHeader);
  if (!data) throw new AppError(ErrorCode.UNAUTHORIZED, "ログインが必要です");
  return data;
}

/**
 * ユーザーが指定ロールを持つことを必須にする。無ければ 403(FORBIDDEN)。
 * @param user 利用者
 * @param roles 必要なロール(**いずれか 1 つ**)
 * @throws {@link @platform/core#AppError} コード `FORBIDDEN` — 権限が無い場合
 */
export function requireRole(user: AuthUser, role: string): void {
  if (!user.roles.includes(role)) {
    throw new AppError(ErrorCode.FORBIDDEN, "この操作を行う権限がありません", { details: { required: role, roles: user.roles } });
  }
}

/**
 * ユーザーが指定権限を持つことを必須にする(RBAC)。無ければ 403。
 * `@platform/auth` の `assertCan` に委譲。
 * @param user 利用者
 * @param permission 必要な権限
 */
export function requirePermission(policy: Policy, user: AuthUser, permission: Permission): void {
  assertCan(policy, user, permission);
}

/**
 * レート制限を強制する。上限超過なら 429(RATE_LIMITED)。
 * ストア障害時はフェイルオープン(通す)し、null を返す。
 *
 * @param limiter `@platform/ratelimit` の `createRateLimiter`
 * @param key 制限キー(`login:${email}` や IP など)
 * @returns 判定結果(通過時)、ストア障害時は null
 * @throws {@link @platform/core#AppError} `RATE_LIMITED`
 *
 * @example
 * ```ts
 * await enforceRateLimit(limiter, `login:${email}`); // 超過なら 429
 * ```
 */
export async function enforceRateLimit(limiter: RateLimiter, key: string): Promise<RateLimitResult | null> {
  const res = await limiter.check(key);
  if (!res.ok) return null; // ストア障害はフェイルオープン(可用性優先)
  if (!res.value.allowed) {
    throw new AppError(ErrorCode.RATE_LIMITED, "リクエストが多すぎます。しばらくしてから再度お試しください。", {
      details: { limit: res.value.limit },
    });
  }
  return res.value;
}
