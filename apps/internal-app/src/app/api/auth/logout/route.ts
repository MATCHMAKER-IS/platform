import { withApiObservability } from "../../../../server/instrument";
import { NextResponse, type NextRequest } from "next/server";
import { currentUserFromValue } from "../../../../server/authorize";
import { loginAudit, auditContext } from "../../../../server/login-audit";
import { serverEnv } from "../../../../server/env";
/** POST /api/auth/logout — セッションを破棄。 */
async function handlePOST(req: NextRequest) {
  const user = currentUserFromValue(req.cookies.get("session")?.value, serverEnv.SESSION_SECRET);

  // **フォーム送信ならログイン画面へ返す。**
  // JSON を返すと、画面が `{"ok":true}` の表示に変わってしまう
  // (利用者は「壊れた」としか受け取れない)。
  // fetch から呼ばれたときは従来どおり JSON を返す。
  const wantsHtml = (req.headers.get("accept") ?? "").includes("text/html");
  const res = wantsHtml
    ? NextResponse.redirect(new URL("/login", req.nextUrl.origin), { status: 303 })
    : NextResponse.json({ ok: true });

  res.cookies.delete("session");
  await loginAudit.logout({ ...(user ? { subject: user.email } : {}), ...auditContext(req) });
  return res;
}

export const POST = withApiObservability("/api/auth/logout", handlePOST);
