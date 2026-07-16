import { withApiObservability } from "../../../../server/instrument";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "../../../../server/authorize";
import { loginAudit, auditContext } from "../../../../server/login-audit";
import { serverEnv } from "../../../../server/env";
/** POST /api/auth/logout — セッションを破棄。 */
async function handlePOST(req: NextRequest) {
  const user = currentUser(req.cookies.get("session")?.value, serverEnv.SESSION_SECRET);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("session");
  await loginAudit.logout({ ...(user ? { subject: user.email } : {}), ...auditContext(req) });
  return res;
}

export const POST = withApiObservability("/api/auth/logout", handlePOST);
