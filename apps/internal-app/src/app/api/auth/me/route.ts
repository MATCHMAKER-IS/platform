import { withApiObservability } from "../../../../server/instrument";
import { NextResponse, type NextRequest } from "next/server";
import { currentUserFromValue, userFeatures } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { userStore } from "../../../../server/platform-services";

/**
 * GET /api/auth/me — ログインユーザー + ロール + 機能フラグ。
 *
 * **無効化された利用者をここで弾く。**
 * セッションは署名付きで最大 8 時間有効なので、退職者を無効化しても
 * それだけでは操作が続けられてしまう(セッションの中身は変わらない)。
 * 全画面が起動時にこれを呼ぶので、ここで見れば実質的に即時反映になる。
 *
 * **部署も返す。** プロフィールの表示に使う(セッションには入っていない)。
 */
async function handleGET(req: NextRequest) {
  const session = currentUserFromValue(req.cookies.get("session")?.value, serverEnv.SESSION_SECRET);
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  // **台帳を引いて現在の状態を見る。**
  // 取れないとき(台帳から消えた等)も入れない
  let record;
  try {
    record = await userStore.get(session.email);
  } catch (e) {
    // **DB が落ちているだけで締め出さない。**
    // ここで 401 を返すと画面がログインへ送り返し、
    // 何度ログインしても戻される(原因が分からない)。
    // セッションは正しいので、その内容で通す
    console.error("[auth/me] 利用者台帳を引けませんでした", e);
    return NextResponse.json({
      user: { email: session.email, name: session.name, roles: session.roles },
      features: userFeatures(session),
      degraded: true,
    });
  }

  // **パスワードを変えたら、それ以前のセッションを失効させる。**
  // 署名付きのクッキーは書き換えられないが、**盗まれたものは期限まで使える**。
  // パスワードの再発行が「乗っ取りへの対処」にならないと困る(2026-08)。
  //
  // `iat` を持たない古いセッションは通す(移行中に全員を締め出さない)。
  if (record !== undefined && session.iat !== undefined && record.passwordSetAt !== undefined) {
    const changedAt = Math.floor(new Date(record.passwordSetAt).getTime() / 1000);
    if (Number.isFinite(changedAt) && session.iat < changedAt) {
      const res = NextResponse.json({ user: null, reason: "password-changed" }, { status: 401 });
      res.cookies.delete("session");
      console.warn(`[auth/me] ${session.email}: パスワード変更前のセッションを失効させました`);
      return res;
    }
  }

  // **一斉無効化。** 退職・異動では権限を消すだけでは足りない(ADR-0017)。
  // セッションが生きていれば、その中身(ロール)で操作が通る
  if (session.iat !== undefined) {
    const revokedAt = await userStore.getSessionsRevokedAt(session.email);
    if (revokedAt !== undefined) {
      const at = Math.floor(new Date(revokedAt).getTime() / 1000);
      if (Number.isFinite(at) && session.iat < at) {
        const res = NextResponse.json({ user: null, reason: "revoked" }, { status: 401 });
        res.cookies.delete("session");
        console.warn(`[auth/me] ${session.email}: 無効化されたセッションです`);
        return res;
      }
    }
  }

  if (record === undefined || !record.active) {
    // **理由を分けて返す。** 「無効化された」と「台帳に居ない」は違う。
    // 前者は意図した締め出しだが、後者は設定の食い違い(seed 忘れなど)
    const reason = record === undefined ? "not-in-directory" : "disabled";
    const res = NextResponse.json({ user: null, reason }, { status: 401 });
    console.warn(`[auth/me] ${session.email} を通しませんでした: ${reason}`);
    // **クッキーも消す。** 残しておくと、無効なまま持ち回ることになる
    res.cookies.delete("session");
    return res;
  }

  return NextResponse.json({
    // **ロールは台帳を正とする。** セッション発行後に権限を変えても反映される
    user: {
      email: record.email,
      name: record.name,
      roles: record.roles,
      department: record.department,
    },
    features: userFeatures({ ...session, roles: record.roles }),
  });
}

export const GET = withApiObservability("/api/auth/me", handleGET);
