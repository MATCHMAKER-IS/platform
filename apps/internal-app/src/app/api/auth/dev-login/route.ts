// public-api: 開発専用のログイン。認可の前段にあるため認可は掛けられない。本番では 404(下記の二重ガード)
/**
 * **開発専用**のログイン。
 *
 * 【なぜ要るか】
 * このアプリのログインは **Zoho SSO だけ**で、`ZOHO_CLIENT_ID` などを設定しないと
 * 一切ログインできない。その状態だと画面は開くが**全 API が 401** を返し、
 * **ローカルでは何も試せない**(2026-08、環境構築を通した人が初めて気づいた)。
 * `docs/ops/ONBOARDING_TASK.md` も、これでは実施できない。
 *
 * 【本番で使えないようにする二重の守り】
 * 1. `isProductionRuntime()` が true なら **404**(存在しないものとして振る舞う)
 * 2. `DEV_LOGIN=1` を明示的に設定しない限り **404**(既定では入り口ごと無い)
 *
 * **どちらか一方では足りない。** 環境変数の設定ミスは起きるし、
 * NODE_ENV の判定も取り違えられる。両方を要求する。
 *
 * 【使い方】
 * `.env` に `DEV_LOGIN=1` を書いてから、ブラウザで開く:
 *
 *     http://localhost:3000/api/auth/dev-login
 *     http://localhost:3000/api/auth/dev-login?email=me@example.co.jp&roles=admin
 *
 * セッションが張られてトップへ戻る。ログアウトは `/api/auth/logout`。
 */
import { NextResponse, type NextRequest } from "next/server";
import { isProductionRuntime } from "@platform/env";
import { signSession } from "../../../../server/zoho-session";
import { featureEnv, serverEnv } from "../../../../server/env";

export const dynamic = "force-dynamic";

/** 開発用セッションの既定の有効時間(8 時間)。 */
const TTL_SEC = 8 * 60 * 60;

export function GET(req: NextRequest): NextResponse {
  // **本番では存在しないものとして扱う。** 401/403 ではなく 404 にするのは、
  // 「開発用の口がある」こと自体を外に知らせないため
  if (isProductionRuntime() || featureEnv.DEV_LOGIN !== "1") {
    return new NextResponse("Not Found", { status: 404 });
  }

  const url = new URL(req.url);
  const email = url.searchParams.get("email") ?? "dev@example.co.jp";
  const roles = (url.searchParams.get("roles") ?? "admin").split(",").map((s) => s.trim()).filter(Boolean);

  const token = signSession(
    { email, name: "開発ユーザー", roles, exp: Math.floor(Date.now() / 1000) + TTL_SEC },
    serverEnv.SESSION_SECRET,
  );

  const res = NextResponse.redirect(new URL("/", req.url));
  // **secure は付けない。** 開発は http なので、付けるとクッキーが保存されず
  // 「ログインしたのに 401 のまま」になる。本番の経路(Zoho)は secure 付き
  res.cookies.set("session", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: TTL_SEC,
    path: "/",
  });
  // 使われたことをログに残す(本番へ紛れ込んだ場合に気づけるように)
  console.warn(`[dev-login] 開発用ログインを使いました: ${email} (${roles.join(", ")})`);
  return res;
}
