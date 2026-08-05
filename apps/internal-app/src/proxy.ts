import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders, createCspNonce } from "@platform/security";
import { isProductionRuntime } from "@platform/env";
import { xRobotsTag } from "@platform/seo";
import {
  createAsyncMaintenanceGate, createCachedConfig, stateToConfig, renderMaintenancePage,
  type MaintenanceState,
} from "@platform/status-page";
import { featureEnv } from "./server/env";

/**
 * Next.js の入口(**Next 16 で `middleware.ts` から `proxy.ts` に改称**。両方あるとビルドが落ちる)。
 *
 * メンテナンス切り替えゲート。
 * 状態は DB(SystemSetting)に永続化され、管理画面 API から再起動なしで切り替えられる。
 * ここは TTL キャッシュ(既定 5 秒)越しに読むため、毎リクエストで DB を叩かない。
 * 静的な運用ポリシー(許可ロール/IP/バイパストークン)は環境変数から与える。
 */
/**
 * 状態は **API 経由**で取る(`/api/maintenance-state`)。
 *
 * **proxy に Prisma のクライアントはバンドルできない。**
 * 直接 DB を読むと「Cannot read properties of undefined (reading 'call')」で落ちる。
 * proxy は全リクエストの前に走るので、そこで DB を叩くこと自体も避けたい。
 *
 * 取得先の origin はリクエストごとに変わる(localhost / 本番ドメイン)ため、
 * proxy の入口で更新する。TTL キャッシュ(5 秒)があるので、
 * **実際の取得は 5 秒に 1 回**。
 */
let originForFetch = "";

const cachedConfig = createCachedConfig(async () => {
  // **取れなければメンテナンス解除として扱う(fail-open)。**
  // ここで失敗して全リクエストを 503 にすると、
  // 状態を戻す管理画面にも入れなくなる。
  let state: MaintenanceState = { enabled: false };
  try {
    const res = await fetch(`${originForFetch}/api/maintenance-state`, { cache: "no-store" });
    if (res.ok) state = (await res.json()) as MaintenanceState;
  } catch {
    // ネットワークエラーも同様に解除扱い
  }
  return stateToConfig(state, {
    allowRoles: ["admin"],
    allowIps: featureEnv.MAINTENANCE_ALLOW_IPS.split(",").map((s) => s.trim()).filter(Boolean),
    bypassHeader: featureEnv.MAINTENANCE_BYPASS_TOKEN
      ? { name: "x-maintenance-bypass", value: featureEnv.MAINTENANCE_BYPASS_TOKEN }
      : undefined,
    retryAfterSeconds: 3600,
  });
}, 5000);

const gate = createAsyncMaintenanceGate(cachedConfig);

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

export async function proxy(req: NextRequest) {
  originForFetch = req.nextUrl.origin;
  const decision = await gate.evaluate({
    path: req.nextUrl.pathname,
    getHeader: (name) => req.headers.get(name),
  });
  if (decision.active) {
    const html = renderMaintenancePage({ brand: "社内システム", estimatedRecovery: decision.estimatedRecovery });
    const res = new NextResponse(html, {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8", "retry-after": String(decision.retryAfterSeconds ?? 3600) },
    });
    // **メンテナンス画面に nonce は要らない**(素の HTML で、script を含まない)。
    // 既定の厳しい CSP のままにする
    for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
    res.headers.set("X-Robots-Tag", xRobotsTag("internal")); // 社内ツールは検索避け
    return res;
  }
  const { res, headers } = withNonce(req);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  res.headers.set("X-Robots-Tag", xRobotsTag("internal")); // 社内ツールは検索避け(HTML以外も含む全レスポンス)
  return res;
}

// **`/api/maintenance-state` を除外する。** proxy 自身がここを fetch するので、
// 対象に含めると proxy → API → proxy … と呼び合う
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/maintenance-state).*)"] };
