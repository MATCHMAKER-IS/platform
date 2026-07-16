import { withApiObservability } from "../../../../../server/instrument";
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { zohoAuthConfigFromEnv, getLoginUrl } from "../../../../../server/zoho-auth";
import { getLoginLimiter, clientIp } from "../../../../../server/rate-limit";

/** GET /api/auth/zoho/login — Zoho 認可画面へリダイレクト(IP レート制限つき)。 */
async function handleGET(req: NextRequest) {
  const rl = await getLoginLimiter().check(`login-start:${clientIp(req)}`);
  if (rl.ok && !rl.value.allowed) {
    return NextResponse.json({ error: "試行回数が上限を超えました。しばらくしてからお試しください" }, { status: 429 });
  }
  const config = zohoAuthConfigFromEnv();
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getLoginUrl(config, state));
  res.cookies.set("zoho_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return res;
}

export const GET = withApiObservability("/api/auth/zoho/login", handleGET);
