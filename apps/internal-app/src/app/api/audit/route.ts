import { maskAuditRow } from "../../../server/pii-view.js";
/**
 * 監査ログ検索 API（GET）。`?actor=&action=&target=&from=&to=&limit=`。
 * 一覧＋チェーン検証結果を返す。監査閲覧は管理者のみ。
 */
import { withApiObservability } from "../../../server/instrument.js";
import { currentUser, userCan, requirePermission } from "../../../server/authorize.js";
import { serverEnv } from "../../../server/env.js";
import { auditLog } from "../../../server/platform-services.js";

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
  if (limit) q.limit = Number(limit) || 100;
  const [rows, verification] = await Promise.all([auditLog.query(q), auditLog.verify()]);
  const unmask = userCan(user, "pii:unmask");
  const masked = rows.map((r) => maskAuditRow(r, unmask));
  return Response.json({ rows: masked, verification });
}

export const GET = withApiObservability("/api/audit", handleGET);
