/**
 * レポート配信スキャン(POST)。期限が来たレポートを生成し宛先へメール＋受信箱で配信。cron 等から定期実行。
 * X-Cron-Token(env CRON_TOKEN)一致、または管理者。
 * 推奨頻度・他の scan API との一覧は `docs/ops/CRON_JOBS.md` を参照。
 */
import { withApiObservability } from "../../../../server/instrument";
import { isCronAuthorized } from "../../../../server/cron-auth";
import { reportScheduleStore, invoiceStore, inventoryStore, appMailer, notificationStore, userStore, deliveryLogStore, settingsStore } from "../../../../server/platform-services";
import { dueReports, buildReportMessage, resolveRecipients, type ReportType } from "../../../../server/report-schedule";
import { salesReport, receivablesReport, inventoryReport, type Report } from "../../../../server/reports";
import { makeDeliveryEntry } from "../../../../server/delivery-log";


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
  if (!(isCronAuthorized(req))) return Response.json({ error: "権限がありません" }, { status: 403 });
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
      // **1 件ずつ送る。** `to` に配列を渡すと受信者全員に他の宛先が
      // 見える(2026-08、他の通知経路と同じ穴を発見して修正)。
      for (const to of recipients) {
        await appMailer.sendMail({ to, from: mailFrom, subject: msg.subject, text: msg.body });
      }
      // **id は必須**(AppNotification)。既読管理に使うので重複しない値を入れる
      for (const email of recipients) {
        await notificationStore.add(email, {
          id: `report-${now.getTime()}-${email}`,
          title: msg.subject, body: summary, createdAt: now.toISOString(),
        });
      }
      deliveries += recipients.length;
    }
    await deliveryLogStore.add(makeDeliveryEntry(now.toISOString(), sched.reportType, recipients));
    await reportScheduleStore.markSent(sched.id, now.toISOString());
    sent += 1;
  }
  return Response.json({ sent, of: due.length, deliveries });
}

export const POST = withApiObservability("/api/admin/report-scan", handlePOST);
