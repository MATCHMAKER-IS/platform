import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders, createCspNonce } from "@platform/security";
import { isProductionRuntime } from "@platform/env";

/**
 * Next.js の入口（**Next 16 で `middleware.ts` から `proxy.ts` に改称**。両方あるとビルドが落ちる）。
 *
 * ここでは**セキュリティヘッダを全レスポンスに付ける**ことだけを行う。
 *
 * 【なぜ要るか】
 * 公開サイトは社内ツールと違い、**誰でも開ける**。攻撃の入口としては最も広い。
 * ヘッダが無いと次のことが起きる:
 *
 *   - `Content-Security-Policy` … 万一 XSS が入ったとき、外部スクリプトの読み込みを止められない
 *   - `X-Frame-Options`         … 別サイトの iframe に埋め込まれ、クリックジャッキングに使われる
 *   - `X-Content-Type-Options`  … ブラウザが中身を推測して、画像を JavaScript として実行しうる
 *   - `Strict-Transport-Security` … 一度でも HTTP で開くと、中間者に書き換えられる
 *
 * 内容は `@platform/security` の `securityHeaders()` が持つ。
 * **アプリごとに書かない**（1 か所直せば全アプリに効く）。
 *
 * 社内ツール（`internal-app`）は検索避け（`X-Robots-Tag`）も付けるが、
 * ここは公開サイトなので付けない。**検索されたいのが目的**。
 */
/**
 * リクエストごとに nonce を作り、CSP とリクエストヘッダの両方に載せる。
 *
 * **Next.js はページの起動に必ずインライン script を使う。**
 * `script-src 'self'` だけだとそれが全部ブロックされ、
 * **画面は出るがボタンが何も反応しない**(ハイドレーションが動かない)。
 * 2026-08 に実際にこの状態で、原因が分かるまで時間がかかった。
 *
 * Next は**リクエストの** `Content-Security-Policy` ヘッダから nonce を読み取り、
 * 自分が出すインライン script に付ける。だから応答だけでなく
 * 要求側にも同じ値を載せる必要がある。
 */
function withNonce(req: NextRequest): { res: NextResponse; headers: Record<string, string> } {
  const nonce = createCspNonce();
  const headers = securityHeaders({
    nonce,
    // **dev サーバは差分更新に eval を使う。** 本番では許可しない。
    // `process.env` を直読みせず @platform/env の口を通す(検査もそう求めている)
    allowEval: !isProductionRuntime(),
  });
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", headers["Content-Security-Policy"] ?? "");
  return { res: NextResponse.next({ request: { headers: requestHeaders } }), headers };
}

export function proxy(_req: NextRequest): NextResponse {
  const { res, headers } = withNonce(_req);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

// 静的ファイルには付けない（配信のたびに通すと無駄なうえ、CDN のキャッシュと噛み合わない）
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
