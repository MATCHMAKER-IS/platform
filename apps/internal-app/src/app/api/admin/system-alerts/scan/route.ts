/**
 * システムアラートの定期評価(cron から呼ぶ)。
 *
 * メトリクスを評価し、**状態が変わったときだけ**通知する。
 * 認証は CRON_TOKEN(管理者セッションではなく、機械が叩くため)。
 *
 * 例: 5 分ごとに実行
 *   curl -H "x-cron-token: $CRON_TOKEN" https://本番URL/api/admin/system-alerts/scan
 */
import { currentUser, requirePermission } from "../../../../../server/authorize";
import { serverEnv } from "../../../../../server/env";
import { withApiObservability } from "../../../../../server/instrument";
import { featureEnv } from "../../../../../server/env";
import { evaluateAndNotify, activeSystemAlerts } from "../../../../../server/system-alerts";

async function handlePOST(req: Request): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "system:manage");
  const token = featureEnv.CRON_TOKEN;
  // トークン未設定なら誰も叩けないようにする(既定で安全側)
  if (!token) return Response.json({ error: "CRON_TOKEN が未設定です" }, { status: 503 });
  if (req.headers.get("x-cron-token") !== token) return Response.json({ error: "認証が必要です" }, { status: 401 });

  const result = await evaluateAndNotify();
  return Response.json({
    changed: result.changes.length,
    changes: result.changes.map((c) => ({ name: c.name, severity: c.severity, firing: c.firing, message: c.message })),
    sent: result.sent,
    failed: result.failed,
    active: activeSystemAlerts().map((a) => a.name),
  });
}

export const POST = withApiObservability("/api/admin/system-alerts/scan", handlePOST);
