// public-api: CSRF トークンの取得。ログイン前のフォームでも必要
// no-rate-limit: トークンの発行。フォーム表示のたびに必要
/** CSRF トークンを発行し、cookie にセットして返す(double-submit 用に非 httpOnly)。 */
import { createCsrf } from "@platform/security";
import { serializeCookie } from "@platform/session";
import { handleRoute } from "@platform/http";
import { showcaseEnv } from "../../../server/env";

const csrf = createCsrf({ secret: showcaseEnv.CSRF_SECRET ?? "" });

async function handleGET(req: Request) {
  const token = csrf.issue();
  return new Response(JSON.stringify({ token }), {
    headers: {
      "content-type": "application/json",
      // CSRF トークンは JS から読む必要があるため httpOnly は付けない。
      // Secure は基盤の既定に任せる(localhost だけ外す)
      "set-cookie": serializeCookie("csrf", token, {
        httpOnly: false,
        secure: new URL(req.url).hostname !== "localhost",
      }),
    },
  });
}

export const GET = handleRoute(handleGET);
