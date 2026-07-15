/** ログアウト(POST)。セッションクッキーを破棄。 */
export async function POST(): Promise<Response> {
  return Response.json({ ok: true }, { headers: { "set-cookie": "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0" } });
}
