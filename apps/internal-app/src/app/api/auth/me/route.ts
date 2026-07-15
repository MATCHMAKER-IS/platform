import { withApiObservability } from "../../../../server/instrument.js";
import { NextResponse, type NextRequest } from "next/server";
import { currentUser, userFeatures } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";

/** GET /api/auth/me — ログインユーザー + ロール + 機能フラグ。 */
function handleGET(req: NextRequest) {
  const user = currentUser(req.cookies.get("session")?.value, serverEnv.SESSION_SECRET);
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: { email: user.email, name: user.name, roles: user.roles },
    features: userFeatures(user),
  });
}

export const GET = withApiObservability("/api/auth/me", handleGET);
