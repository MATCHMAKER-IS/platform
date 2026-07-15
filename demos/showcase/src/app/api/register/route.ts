/** 登録 API。CSRF 検証 → ハニーポット判定 → 受理。 */
import { handleRoute } from "@platform/http";
import { createCsrf, assertCsrf } from "@platform/security";

const csrf = createCsrf({ secret: process.env.CSRF_SECRET ?? "showcase-demo-secret-change-me" });

function parseCookie(header: string): Record<string, string> {
  return Object.fromEntries(
    header.split(";").map((c) => c.trim().split("=")).filter((p) => p[0]).map((p) => [p[0], decodeURIComponent(p[1] ?? "")]),
  );
}

export const POST = handleRoute(async (req: Request) => {
  const cookie = parseCookie(req.headers.get("cookie") ?? "")["csrf"];
  const header = req.headers.get("x-csrf-token");
  assertCsrf(csrf, header, cookie); // 不正なら 403

  const body = (await req.json()) as Record<string, unknown>;
  // ハニーポットが埋まっていればボットとして黙って破棄(成功を装う)
  if (typeof body._hp === "string" && body._hp.trim()) return Response.json({ ok: true });

  return Response.json({ ok: true, name: body.name });
});
