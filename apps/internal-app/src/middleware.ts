import { NextResponse, type NextRequest } from "next/server";
import { securityHeaders } from "@platform/security";
import { xRobotsTag } from "@platform/seo";
import {
  createAsyncMaintenanceGate, createCachedConfig, stateToConfig, renderMaintenancePage,
} from "@platform/status-page";
import { createDbMaintenanceStore } from "./server/maintenance-store.js";
import { featureEnv } from "./server/env.js";

/**
 * メンテナンス切り替えゲート。
 * 状態は DB(SystemSetting)に永続化され、管理画面 API から再起動なしで切り替えられる。
 * middleware は TTL キャッシュ(既定 5 秒)越しに読むため、毎リクエストで DB を叩かない。
 * 静的な運用ポリシー(許可ロール/IP/バイパストークン)は環境変数から与える。
 */
const store = createDbMaintenanceStore();
const cachedConfig = createCachedConfig(async () =>
  stateToConfig(await store.get(), {
    allowRoles: ["admin"],
    allowIps: featureEnv.MAINTENANCE_ALLOW_IPS.split(",").map((s) => s.trim()).filter(Boolean),
    bypassHeader: featureEnv.MAINTENANCE_BYPASS_TOKEN
      ? { name: "x-maintenance-bypass", value: featureEnv.MAINTENANCE_BYPASS_TOKEN }
      : undefined,
    retryAfterSeconds: 3600,
  }),
5000);
const gate = createAsyncMaintenanceGate(cachedConfig);

export async function middleware(req: NextRequest) {
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
    for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
    res.headers.set("X-Robots-Tag", xRobotsTag("internal")); // 社内ツールは検索避け
    return res;
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  res.headers.set("X-Robots-Tag", xRobotsTag("internal")); // 社内ツールは検索避け(HTML以外も含む全レスポンス)
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
