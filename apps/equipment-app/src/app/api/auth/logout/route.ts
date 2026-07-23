// public-api: セッションを破棄するだけで、未ログインでも無害
/** ログアウト(POST)。セッションクッキーを破棄。 */
import { clearCookie } from "@platform/session";
export async function POST(req: Request): Promise<Response> {
  return Response.json({ ok: true }, {
    headers: { "set-cookie": clearCookie("session", { secure: new URL(req.url).hostname !== "localhost" }) },
  });
}
