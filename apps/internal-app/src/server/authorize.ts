/**
 * ルートハンドラ用の認可ヘルパー(セッション→権限チェック)。
 * @packageDocumentation
 */
import { can, canScoped, featureFlags, type Policy } from "@platform/auth";
import { getCookie } from "@platform/session";
import { verifySession, type SessionPayload } from "./zoho-session";
import { serverEnv } from "./env";
import { APP_POLICY, APP_FEATURES } from "./policy";

/**
 * リクエストから現在のユーザーを取り出す。未ログインは null。
 *
 * **クッキーの解析は基盤(`@platform/session` の `getCookie`)に任せる。**
 * 2026-08 まで、呼び出し側 249 か所が
 * `req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1]` と自作していた。
 * この正規表現は**部分一致**なので、`zoho_session=...` のように
 * 名前が `session` で終わる別のクッキーがあると**そちらの値を返す**
 * (このアプリは Zoho 連携なので現実的な危険だった)。
 * URL エンコードも解けない。`getCookie` は名前で正しく分割し、デコードもする。
 *
 * 秘密鍵は既定で `serverEnv.SESSION_SECRET`。**テストでは第 2 引数で差し替える。**
 */
export function currentUser(
  request: Request,
  secret: string = serverEnv.SESSION_SECRET,
): SessionPayload | null {
  const value = getCookie(request.headers.get("cookie"), "session");
  // **入れ替え中は旧鍵でも通す**(未設定なら何も変わらない)。
  // 手順は docs/ops/SECRET_ROTATION.md
  return value ? verifySession(value, secret, serverEnv.SESSION_SECRET_PREVIOUS) : null;
}

/**
 * すでに取り出したクッキーの値から利用者を取り出す。
 *
 * **Request を持てない場所のためだけにある**(Next.js の `cookies()` ストアなど)。
 * リクエストがあるなら {@link currentUser} を使うこと。
 */
export function currentUserFromValue(cookieValue: string | undefined | null, secret: string): SessionPayload | null {
  return cookieValue ? verifySession(cookieValue, secret, serverEnv.SESSION_SECRET_PREVIOUS) : null;
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
