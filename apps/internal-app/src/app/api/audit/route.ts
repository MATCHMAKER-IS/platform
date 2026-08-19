import { maskAuditRow } from "../../../server/pii-view";
/**
 * 監査ログ検索 API（GET）。`?actor=&action=&target=&from=&to=&limit=`。
 * 一覧＋チェーン検証結果を返す。監査閲覧は管理者のみ。
 */
import { withApiObservability } from "../../../server/instrument";
import { currentUser, userCan, requirePermission } from "../../../server/authorize";
import "../../../server/env";
import { auditLog } from "../../../server/platform-services";

async function handleGET(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "audit:read");
  const url = new URL(req.url);
  const q: { actor?: string; action?: string; target?: string; from?: string; to?: string; limit?: number } = {};
  for (const k of ["actor", "action", "target", "from", "to"] as const) {
    const v = url.searchParams.get(k);
    if (v) q[k] = v;
  }
  // **既定で 200 件に絞る。** 2026-08 まで `limit` を渡さなければ**無制限**で、
  // 画面は渡していなかった——**監査ログは増え続ける**ので、
  // 開くたびに全件を読み込んで描画することになる。
  //
  // **200 は「1 画面をスクロールして追える量」**。それ以上は絞り込むか、
  // CSV で落として表計算で見る方が早い(`?format=csv` がある)。
  const limit = url.searchParams.get("limit");
  q.limit = limit ? Math.min(Number(limit) || 200, 1000) : 200;
  const [rows, verification] = await Promise.all([auditLog.query(q), auditLog.verify()]);
  const unmask = userCan(user, "pii:unmask");
  const masked = rows.map((r) => maskAuditRow(r, unmask));
  return Response.json({ rows: masked, verification });
}

export const GET = withApiObservability("/api/audit", handleGET);
