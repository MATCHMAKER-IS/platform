// public-api: デモのログアウト
/** ログアウト(セッションクッキーを失効)。 */
import { session } from "../../../server/session";
import { handleRoute } from "@platform/http";

async function handlePOST() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json", "set-cookie": session.destroy() },
  });
}

export const POST = handleRoute(handlePOST);
