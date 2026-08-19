/** 運用アラート: アラートを自分の通知センターへ配信(POST)。dashboard:read。 */
import { withApiObservability } from "../../../../server/instrument";
// **二重送信を防ぐ。** アラート送信は連打・再送で二重に走ると、
// 同じ通知が 2 通届き、**通知そのものが信用されなくなる**。
import { withIdempotency } from "@platform/http";
import { idempotencyStore } from "../../../../server/idempotency";
import { currentUser, requirePermission } from "../../../../server/authorize";
import "../../../../server/env";
import { notificationCenter, auditActions } from "../../../../server/platform-services";
import { buildAlerts } from "../../../../server/alerts";
import { appMailer } from "../../../../server/platform-services";
import { alertsEmail } from "../../../../server/alert-mail";
import { collectAlertInput } from "../../../../server/alert-collect";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req);
  requirePermission(user, "dashboard:read");
  // **キーが無ければ素通し。** 付けるのは呼び出し側の責任。
  return withIdempotency(req, { store: idempotencyStore, scope: user!.email }, () => run(user!.email));
}

/** 本体(冪等キーの内側で 1 回だけ動く)。 */
async function run(actor: string): Promise<Response> {
  const alerts = buildAlerts(await collectAlertInput());
  for (const a of alerts) await notificationCenter.notify(actor, { title: a.title, body: a.body, href: a.href });
  // メールが設定されていれば通知に加えてメールでも送る（この環境では Transport 未設定のため通知のみ）
  let emailed = false;
  if (alerts.length > 0) {
    const res = await appMailer.sendMail(alertsEmail(actor, alerts));
    emailed = res.ok;
  }
  await auditActions.record(actor, "alerts.dispatch", `count:${alerts.length}`, { after: { count: alerts.length, emailed } });
  return Response.json({ sent: alerts.length, emailed });
}

export const POST = withApiObservability("/api/alerts/dispatch", handlePOST);
