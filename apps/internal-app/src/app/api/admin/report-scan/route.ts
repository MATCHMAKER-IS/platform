/**
 * レポート配信スキャン(POST)。期限が来たレポートを生成し宛先へメール＋受信箱で配信。cron 等から定期実行。
 * X-Cron-Token(env CRON_TOKEN)一致、または管理者。
 */
import { withApiObservability } from "../../../../server/instrument.js";
import { currentUser } from "../../../../server/authorize.js";
import { serverEnv, featureEnv } from "../../../../server/env.js";
import { reportScheduleStore, invoiceStore, inventoryStore, appMailer, notificationStore, userStore, deliveryLogStore, settingsStore } from "../../../../server/platform-services.js";
import { dueReports, buildReportMessage, resolveRecipients, type ReportType } from "../../../../server/report-schedule.js";
import { salesReport, receivablesReport, inventoryReport, type Report } from "../../../../server/reports.js";
import { makeDeliveryEntry } from "../../../../server/delivery-log.js";

async function authorized(req: Request): Promise<boolean> {
  const token = featureEnv.CRON_TOKEN;
  if (token && req.headers.get("x-cron-token") === token) return true;
  const user = currentUser(req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1], serverEnv.SESSION_SECRET);
  return !!user && user.roles.includes("admin");
}

async function buildReport(type: ReportType, now: Date): Promise<Report> {
  if (type === "inventory") {
    const stock = await inventoryStore.status();
    return inventoryReport(stock.map((s) => ({ sku: s.product.sku, name: s.product.name, onHand: s.summary.onHand, needsReorder: s.needsReorder, suggestedOrderQty: s.suggestedOrderQty })), now);
  }
  const invoices = await invoiceStore.list();
  return type === "sales"
    ? salesReport(invoices.map((i) => ({ number: i.number, billTo: i.billTo, total: i.totals?.total ?? 0, balance: i.balance ?? 0 })), now)
    : receivablesReport(invoices.map((i) => ({ number: i.number, billTo: i.billTo, balance: i.balance ?? 0, dueDate: i.dueDate, status: i.status })), now);
}

async function handlePOST(req: Request): Promise<Response> {
  if (!(await authorized(req))) return Response.json({ error: "権限がありません" }, { status: 403 });
  const now = new Date();
  const mailFrom = (await settingsStore.get()).mailFrom;
  const due = dueReports(await reportScheduleStore.list(), now);
  const users = await userStore.list();
  let sent = 0;
  let deliveries = 0;
  for (const sched of due) {
    const report = await buildReport(sched.reportType, now);
    const summary = `${report.rows.length} 行のレポートを生成しました。`;
    const msg = buildReportMessage(sched.reportType, now, summary);
    const recipients = resolveRecipients(sched.recipient, users);
    if (recipients.length > 0) {
      await appMailer.sendMail({ to: recipients, from: mailFrom, subject: msg.subject, text: msg.body });
      for (const email of recipients) await notificationStore.add(email, { title: msg.subject, body: summary, createdAt: now.toISOString() });
      deliveries += recipients.length;
    }
    await deliveryLogStore.add(makeDeliveryEntry(now.toISOString(), sched.reportType, recipients));
    await reportScheduleStore.markSent(sched.id, now.toISOString());
    sent += 1;
  }
  return Response.json({ sent, of: due.length, deliveries });
}

export const POST = withApiObservability("/api/admin/report-scan", handlePOST);
