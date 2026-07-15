/** ログイン(POST {email,password})。成功で HttpOnly セッションクッキーを発行。初期ユーザー: admin@example.com(env ADMIN_PASSWORD)。 */
import { login, signSession, SESSION_MAX_AGE } from "../../../../server/auth.js";
import { serverEnv } from "../../../../server/env.js";
import "../../../../server/guard.js"; // 初期ユーザー播種

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json()) as Partial<{ email: string; password: string }>;
  if (!body.email || !body.password) return Response.json({ error: "email と password は必須です" }, { status: 400 });
  const payload = login(body.email, body.password);
  if (!payload) return Response.json({ error: "メールまたはパスワードが違います" }, { status: 401 });
  const token = signSession(payload, serverEnv.SESSION_SECRET);
  return Response.json(
    { user: { email: payload.email, name: payload.name, roles: payload.roles } },
    { headers: { "set-cookie": `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}` } },
  );
}
