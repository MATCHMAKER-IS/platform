// public-api: デモの登録。ログイン前に呼ぶ
/** 登録 API。CSRF 検証 → ハニーポット判定 → 受理。 */
import { handleRoute } from "@platform/http";
// **登録は総当たりの入口。** 試行回数を絞らないと、
// 弱いパスワードは時間さえかければ必ず破られる。
import { checkRateLimit, clientIp } from "../../../server/rate-limit";
import { showcaseEnv } from "../../../server/env";
import { createCsrf, assertCsrf } from "@platform/security";

const csrf = createCsrf({ secret: showcaseEnv.CSRF_SECRET ?? "" });

function parseCookie(header: string): Record<string, string> {
  return Object.fromEntries(
    header.split(";").map((c) => c.trim().split("=")).filter((p) => p[0]).map((p) => [p[0], decodeURIComponent(p[1] ?? "")]),
  );
}

export const POST = handleRoute(async (req: Request) => {
  // **IP で数える。** メールが分かる時点ではまだ本文を読んでいないため。
  const limited = await checkRateLimit([`登録:${clientIp(req)}`]);
  if (limited) return limited;

  const cookie = parseCookie(req.headers.get("cookie") ?? "")["csrf"];
  const header = req.headers.get("x-csrf-token");
  assertCsrf(csrf, header, cookie); // 不正なら 403

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  // ハニーポットが埋まっていればボットとして黙って破棄(成功を装う)
  if (typeof body._hp === "string" && body._hp.trim()) return Response.json({ ok: true });

  return Response.json({ ok: true, name: body.name });
});
