// public-api: CSRF トークンの取得。ログイン前のフォームでも必要
/** CSRF トークンを発行し、cookie にセットして返す(double-submit 用に非 httpOnly)。 */
import { createCsrf } from "@platform/security";
import { serializeCookie } from "@platform/session";

const csrf = createCsrf({ secret: process.env.CSRF_SECRET ?? "showcase-demo-secret-change-me" });

export async function GET(req: Request) {
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
