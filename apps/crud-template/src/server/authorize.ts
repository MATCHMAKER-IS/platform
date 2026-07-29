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
import { setContextValue } from "@platform/context";
import { AppError, ErrorCode } from "@platform/core";
import { env } from "./env";

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
 * 開発用の仮ログイン。**本番では使われない**({@link currentUser} が例外を投げる)。
 *
 * 名前を付けてあるのは、置き換え忘れを検索で見つけられるようにするため
 * (`node tools/check-auth-stub.mjs` もこの形を探している)。
 */
const STUB_USER: CurrentUser = { id: "demo-user", roles: ["editor"] };

/**
 * リクエストから利用者を取り出す。
 *
 * **雛形では固定値を返す**(認証の作り込みはアプリごとに違うため)。
 * 実装するときは @platform/session の `verifySession` でセッション Cookie を検証し、
 * 中身の userId / roles を返す。実際に動く例は `apps/equipment-app/src/server/guard.ts`、
 * 画面込みの流れは `/login` デモにある。
 *
 * **本番では必ず例外を投げる。** 固定値を返したまま公開すると、`requirePermission` は
 * 通るのに**誰でも全操作できる**状態になる。しかも認可を書いてあるので
 * `check-api-auth` は緑のままで、検査からは正常に見える —— 気づけない壊れ方なので、
 * 動かないことで気づかせる。
 *
 * 誰か分かった時点で `userId` をリクエストコンテキストへ載せる。**ここが唯一の
 * 身元確定点**なので、ここで載せておけば以降のログすべてに自動で付く。
 * 差し替えるときも、この 1 行を残せば相関は保たれる。
 *
 * @throws {@link @platform/core#AppError} コード `INTERNAL` — 本番環境で認証が未実装のまま呼ばれた場合
 */
export function currentUser(_req: Request): CurrentUser | null {
  if (env.NODE_ENV === "production") {
    throw new AppError(
      ErrorCode.INTERNAL,
      "認証が実装されていません。apps/crud-template/src/server/authorize.ts の currentUser を "
      + "実際のセッション検証に差し替えてください(実例: apps/equipment-app/src/server/guard.ts)",
    );
  }
  const user: CurrentUser | null = STUB_USER;
  if (user) setContextValue("userId", user.id);
  return user;
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
