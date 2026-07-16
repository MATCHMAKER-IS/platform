/** 運用アラート: アラートを自分の通知センターへ配信(POST)。dashboard:read。 */
import { withApiObservability } from "../../../../server/instrument";
import { currentUser, requirePermission } from "../../../../server/authorize";
import { serverEnv } from "../../../../server/env";
import { notificationCenter, auditActions } from "../../../../server/platform-services";
import { buildAlerts } from "../../../../server/alerts";
import { appMailer } from "../../../../server/platform-services";
import { alertsEmail } from "../../../../server/alert-mail";
import { collectAlertInput } from "../../../../server/alert-collect";

async function handlePOST(req: Request): Promise<Response> {
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  requirePermission(user, "dashboard:read");
  const alerts = buildAlerts(await collectAlertInput());
  for (const a of alerts) await notificationCenter.notify(user!.email, { title: a.title, body: a.body, href: a.href });
  // メールが設定されていれば通知に加えてメールでも送る（この環境では Transport 未設定のため通知のみ）
  let emailed = false;
  if (alerts.length > 0) {
    const res = await appMailer.sendMail(alertsEmail(user!.email, alerts));
    emailed = res.ok;
  }
  await auditActions.record(user!.email, "alerts.dispatch", `count:${alerts.length}`, { after: { count: alerts.length, emailed } });
  return Response.json({ sent: alerts.length, emailed });
}

export const POST = withApiObservability("/api/alerts/dispatch", handlePOST);
