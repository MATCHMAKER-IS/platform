import { withApiObservability } from "../../../../../server/instrument";
import { NextResponse, type NextRequest } from "next/server";
import { zohoAuthConfigFromEnv, handleZohoCallback } from "../../../../../server/zoho-auth";
import { getLoginLimiter, clientIp } from "../../../../../server/rate-limit";
import { loginAudit, auditContext } from "../../../../../server/login-audit";

/** GET /api/auth/zoho/callback — コードを受け取りセッションを発行。 */
async function handleGET(req: NextRequest) {
  const rl = await getLoginLimiter().check(`login-callback:${clientIp(req)}`);
  if (rl.ok && !rl.value.allowed) {
    await loginAudit.accountLocked({ method: "zoho_oidc", reason: "rate_limited", ...auditContext(req) });
    return NextResponse.json({ error: "試行回数が上限を超えました" }, { status: 429 });
  }
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = req.cookies.get("zoho_oauth_state")?.value;
  if (!code) return NextResponse.json({ error: "code がありません" }, { status: 400 });
  if (!state || state !== expectedState) return NextResponse.json({ error: "state が一致しません" }, { status: 400 });

  const config = zohoAuthConfigFromEnv();
  const result = await handleZohoCallback(config, code);
  if (!result.ok) {
    await loginAudit.loginFailure({ method: "zoho_oidc", reason: result.error, ...auditContext(req) });
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.set("session", result.sessionToken, { httpOnly: true, secure: true, sameSite: "lax", maxAge: config.sessionTtlSec ?? 28800, path: "/" });
  res.cookies.delete("zoho_oauth_state");
  await loginAudit.loginSuccess({ subject: result.user.email, method: "zoho_oidc", ...auditContext(req) });
  return res;
}

export const GET = withApiObservability("/api/auth/zoho/callback", handleGET);
