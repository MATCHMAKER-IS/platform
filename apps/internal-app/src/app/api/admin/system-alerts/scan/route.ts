/**
 * システムアラートの定期評価(cron から呼ぶ)。
 *
 * メトリクスを評価し、**状態が変わったときだけ**通知する。
 * 認証は CRON_TOKEN(管理者セッションではなく、機械が叩くため)。
 *
 * 例: 5 分ごとに実行
 *   curl -H "x-cron-token: $CRON_TOKEN" https://本番URL/api/admin/system-alerts/scan
 * 推奨頻度・他の scan API との一覧は `docs/ops/CRON_JOBS.md` を参照。
 */
import { currentUser, requirePermission } from "../../../../../server/authorize";
// **鍵の比較は定数時間で。** `===` は一致した文字数だけ時間が変わり、
// 応答時間の差から 1 文字ずつ正解を絞り込める(タイミング攻撃)。
import { timingSafeEqual } from "node:crypto";
import "../../../../../server/env";
import { withApiObservability } from "../../../../../server/instrument";
import { featureEnv } from "../../../../../server/env";
import { evaluateAndNotify, activeSystemAlerts } from "../../../../../server/system-alerts";

async function handlePOST(req: Request): Promise<Response> {
  // 認可: この API を叩いてよいかを最初に判定する
  const user = currentUser(req);
  requirePermission(user, "system:manage");
  const token = featureEnv.CRON_TOKEN;
  // トークン未設定なら誰も叩けないようにする(既定で安全側)
  if (!token) return Response.json({ error: "CRON_TOKEN が未設定です" }, { status: 503 });
  // **トークンは定数時間で比べる。**
  // `!==` は一致した文字数で時間が変わり、1 文字ずつ絞り込める。
  // ここは権限も求めるので二重の守りだが、比較そのものは正しくする
  const got = req.headers.get("x-cron-token") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "認証が必要です" }, { status: 401 });
  }

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
