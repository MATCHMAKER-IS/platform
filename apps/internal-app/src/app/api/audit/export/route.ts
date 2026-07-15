/**
 * 監査ログ CSV エクスポート API（GET）。検索条件は /api/audit と同じ。
 * Excel で文字化けしないよう BOM 付き。ファイル名は audit-YYYYMMDD.csv。管理者のみ。
 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser, requirePermission } from "../../../../server/authorize.js";
import { serverEnv } from "../../../../server/env.js";
import { auditLog } from "../../../../server/platform-services.js";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "audit:read");
  const url = new URL(req.url);
  const q: { actor?: string; action?: string; target?: string; from?: string; to?: string; limit?: number } = {};
  for (const k of ["actor", "action", "target", "from", "to"] as const) {
    const v = url.searchParams.get(k);
    if (v) q[k] = v;
  }
  const limit = url.searchParams.get("limit");
  if (limit) q.limit = Number(limit) || 10000;
  const csv = await auditLog.exportCsv(q);
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-${date}.csv"`,
    },
  });
}

export const GET = withApiObservability("/api/audit/export", handleGET);
