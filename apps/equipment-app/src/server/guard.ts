/** ルート用ガード。import された時点で初期ユーザーを播種し、requireUser で認可する。 */
import { seedUsers, sessionFromRequest, type SessionPayload } from "./auth";
import { serverEnv } from "./env";

seedUsers(serverEnv.ADMIN_PASSWORD);

/** ログイン済みユーザーを返す。未ログインは null(ルート側で 401 を返す)。 */
export function requireUser(req: Request): SessionPayload | null {
  return sessionFromRequest(req, serverEnv.SESSION_SECRET);
}
