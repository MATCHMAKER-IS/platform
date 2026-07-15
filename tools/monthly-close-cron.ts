/**
 * 月次締めの自動集計・配信(cron × report × xlsx × mail/notify)。
 * 毎月1日 9:00 に前月分を集計して Excel を作り、経理へメール + Slack 通知する。
 * 実運用は apps/* のサーバ起動時に scheduler.start() する。
 */
import { createScheduler } from "@platform/cron";
import { monthlyExpenseSummary, monthlyReportSheets, type ExpenseRecord } from "@platform/report";
import { writeWorkbook } from "@platform/xlsx";
import { createMailer, createSmtpTransport } from "@platform/mail";
import { createNotifier, createSlackChannel } from "@platform/notify";

// 依存(実際は DI で受け取る)
declare function loadExpenses(yearMonth: string): Promise<ExpenseRecord[]>;

function prevYearMonth(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function startMonthlyClose(config: { smtp: Parameters<typeof createSmtpTransport>[0]; from: string; to: string; slackWebhook: string }) {
  const mailer = createMailer({ transport: createSmtpTransport(config.smtp), from: config.from });
  const notifier = createNotifier([createSlackChannel(config.slackWebhook)]);

  const scheduler = createScheduler(
    [
      {
        name: "monthly-expense-close",
        schedule: "0 9 1 * *", // 毎月1日 9:00
        handler: async () => {
          const ym = prevYearMonth();
          const records = await loadExpenses(ym);
          const summary = monthlyExpenseSummary(records, ym);
          const xlsx = await writeWorkbook(monthlyReportSheets(summary));
          if (!xlsx.ok) throw xlsx.error;

          await mailer.sendMail({
            to: config.to,
            subject: `【月次締め】${ym} 経費レポート`,
            text: `${ym} の経費: ${summary.count}件 / 税込 ¥${summary.total.toLocaleString()}`,
            attachments: [{ filename: `expense-${ym}.xlsx`, content: xlsx.value }],
          });
          await notifier.notify({ text: `月次締め完了 ${ym}: ${summary.count}件 ¥${summary.total.toLocaleString()}`, level: "info" });
        },
      },
    ],
    (name, error) => console.error(`[cron:${name}]`, error.message),
  );

  scheduler.start();
  return scheduler;
}
