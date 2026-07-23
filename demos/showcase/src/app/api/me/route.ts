// public-api: デモ用。セッションの有無を返すだけで、無ければ未ログインとして扱う
/** 現在のセッションを返す。 */
import { session } from "../../../server/session";

export async function GET(req: Request) {
  const s = session.read(req.headers.get("cookie"));
  if (!s) return Response.json({ user: null }, { status: 200 });
  return Response.json({ user: { email: s.email, loginAt: s.loginAt } });
}
