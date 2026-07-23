// public-api: ログイン前に呼ぶため認可を通さない(ここで認証する)
/** ログイン(POST {email,password})。成功で HttpOnly セッションクッキーを発行。初期ユーザー: admin@example.com(env ADMIN_PASSWORD)。 */
import { login, signSession, SESSION_MAX_AGE } from "../../../../server/auth";
import { serverEnv } from "../../../../server/env";
import { checkLoginAttempt, clientIp } from "../../../../server/login-limit";
import { serializeCookie } from "@platform/session";
import "../../../../server/guard.js"; // 初期ユーザー播種

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as Partial<{ email: string; password: string }>;
  if (!body.email || !body.password) return Response.json({ error: "email と password は必須です" }, { status: 400 });
  // 総当たり対策: 成否に関わらず 1 回分数える(失敗だけ数えると素通りする)
  const attempt = await checkLoginAttempt(body.email, clientIp(req));
  if (!attempt.allowed) {
    return Response.json(
      { error: "試行回数が多すぎます。しばらく待ってからやり直してください" },
      { status: 429, headers: { "retry-after": "900" } },
    );
  }

  const payload = login(body.email, body.password);
  // 失敗の理由(メールが無い / パスワードが違う)は区別しない。
  // 区別すると「そのメールは登録されている」ことが分かってしまう
  if (!payload) return Response.json({ error: "メールまたはパスワードが違います" }, { status: 401 });
  const token = signSession(payload, serverEnv.SESSION_SECRET);
  return Response.json(
    { user: { email: payload.email, name: payload.name, roles: payload.roles } },
    // Cookie は基盤の serializeCookie で作る。手書きすると Secure の付け忘れが起きる
    // (開発は http なので、localhost のときだけ Secure を外す)
    {
      headers: {
        "set-cookie": serializeCookie("session", token, {
          maxAge: SESSION_MAX_AGE,
          secure: new URL(req.url).hostname !== "localhost",
        }),
      },
    },
  );
}
