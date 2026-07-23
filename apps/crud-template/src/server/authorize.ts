/**
 * 認可(誰が何をしてよいか)。
 *
 * **雛形の時点で入れてある**のは、後から足すのが難しいため。
 * 「動いてから認可を足す」と、既に画面と API が増えていて漏れが生まれる。
 *
 * ここはアプリごとに変わる部分(ロールと権限の一覧)なので、
 * 基盤ではなくアプリ側に置く。判定そのものは @platform/auth に任せる。
 * @packageDocumentation
 */
import { can, resolveHierarchy, type Policy } from "@platform/auth";
import { AppError, ErrorCode } from "@platform/core";

/** このアプリのロールと権限。**ここを書き換えて使う。** */
export const APP_POLICY: Policy = resolveHierarchy({
  // 閲覧のみ
  viewer: { permissions: ["item:read"] },
  // 登録・更新もできる
  editor: { inherits: ["viewer"], permissions: ["item:write"] },
  // 何でもできる
  admin: { inherits: ["editor"], permissions: ["*"] },
});

/** ログイン中の利用者。実際にはセッションから取り出す。 */
export interface CurrentUser {
  id: string;
  roles: string[];
}

/**
 * リクエストから利用者を取り出す。
 *
 * **雛形では固定値を返す**(認証の作り込みはアプリごとに違うため)。
 * 実装するときは @platform/session の `verifySession` でセッション Cookie を検証し、
 * 中身の userId / roles を返す。`/login` デモに一連の流れがある。
 */
export function currentUser(_req: Request): CurrentUser | null {
  return { id: "demo-user", roles: ["editor"] };
}

/**
 * 権限が無ければ例外を投げる。API ハンドラの冒頭で呼ぶ。
 *
 * @throws AppError 未ログインなら UNAUTHORIZED、権限不足なら FORBIDDEN
 */
export function requirePermission(user: CurrentUser | null, permission: string): CurrentUser {
  if (!user) throw new AppError(ErrorCode.UNAUTHORIZED, "ログインが必要です");
  if (!can(APP_POLICY, user.roles, permission)) {
    throw new AppError(ErrorCode.FORBIDDEN, `権限がありません: ${permission}`);
  }
  return user;
}
