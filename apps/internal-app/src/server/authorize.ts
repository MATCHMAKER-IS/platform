/**
 * ルートハンドラ用の認可ヘルパー(セッション→権限チェック)。
 * @packageDocumentation
 */
import { can, canScoped, featureFlags, type Policy } from "@platform/auth";
import { verifySession, type SessionPayload } from "./zoho-session.js";
import { APP_POLICY, APP_FEATURES } from "./policy.js";

/** クッキーから現在のユーザーを取り出す。未ログインは null。 */
export function currentUser(cookieValue: string | undefined, secret: string): SessionPayload | null {
  return cookieValue ? verifySession(cookieValue, secret) : null;
}

/** 権限を持つか(ポリシーは既定でアプリポリシー)。 */
export function userCan(user: SessionPayload | null, permission: string, policy: Policy = APP_POLICY): boolean {
  return user ? can(policy, user.roles, permission) : false;
}

/** スコープ付き(own/any)判定。 */
export function userCanScoped(user: SessionPayload | null, action: string, isOwner: boolean, policy: Policy = APP_POLICY): boolean {
  return user ? canScoped(policy, user.roles, action, { isOwner }) : false;
}

/** 認可エラー(未ログイン=401, 権限不足=403)。 */
export class AuthzError extends Error {
  readonly status: 401 | 403;
  constructor(status: 401 | 403, message: string) { super(message); this.status = status; }
}

/** 権限を必須にする。満たさなければ AuthzError を throw。 */
export function requirePermission(user: SessionPayload | null, permission: string, policy: Policy = APP_POLICY): SessionPayload {
  if (!user) throw new AuthzError(401, "ログインが必要です");
  if (!can(policy, user.roles, permission)) throw new AuthzError(403, `権限がありません: ${permission}`);
  return user;
}

/** ユーザーの機能フラグ(UI 出し分け用)。 */
export function userFeatures(user: SessionPayload | null): Record<string, boolean> {
  if (!user) return {};
  return featureFlags(APP_POLICY, user.roles, APP_FEATURES);
}
