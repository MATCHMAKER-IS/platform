/**
 * Next.js のミドルウェア(Next 16 では proxy.ts)。
 * 全レスポンスに基盤のセキュリティヘッダを付与する。
 */
import { NextResponse } from "next/server";
import { securityHeaders } from "@platform/security";

export function proxy() {
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  return res;
}

export const config = { matcher: "/:path*" };
