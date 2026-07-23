// public-api: デモのログアウト
/** ログアウト(セッションクッキーを失効)。 */
import { session } from "../../../server/session";

export async function POST() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json", "set-cookie": session.destroy() },
  });
}
