/**
 * ルート用ガード。import された時点で初期ユーザーを播種する。
 *
 * currentUser … ログイン中の利用者を返す(未ログインは null)
 * requireUserOrThrow … 未ログインなら 401 を投げる(判定の書き忘れを防ぐ)
 */
import { seedUsers, sessionFromRequest, type SessionPayload } from "./auth";
import { AppError, ErrorCode } from "@platform/core";
import { serverEnv } from "./env";

seedUsers(serverEnv.ADMIN_PASSWORD);

/** ログイン済みユーザーを返す。未ログインは null(ルート側で 401 を返す)。 */
/**
 * ログイン中の利用者を返す(未ログインなら null)。
 *
 * **名前に反して強制はしない**という誤解を避けるため、
 * 強制したいときは requireUserOrThrow を使う。
 */
export function currentUser(req: Request): SessionPayload | null {
  return sessionFromRequest(req, serverEnv.SESSION_SECRET);
}

/**
 * ログインしていなければ 401 を投げる。
 *
 * 呼び出し側で null 判定を書き忘れる事故を防ぐため、
 * **判定ごと基盤側に寄せた**形。新しい API はこちらを使う。
 */
export function requireUserOrThrow(req: Request): SessionPayload {
  const user = currentUser(req);
  if (!user) throw new AppError(ErrorCode.UNAUTHORIZED, "ログインが必要です");
  return user;
}
