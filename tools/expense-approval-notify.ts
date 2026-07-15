/**
 * 承認の実通知(workflow × notify(Slack) × mail)配線例。
 * approve/reject 後に、次の承認者へ Slack + メールで通知する。
 */
import { approve, notificationForTransition, approverRecipients, type WorkflowDefinition, type WorkflowState, type Actor, type ApproverDirectory } from "@platform/workflow";
import { createNotifier, createSlackChannel } from "@platform/notify";
import { createMailer, createSmtpTransport } from "@platform/mail";

const FLOW: WorkflowDefinition = { steps: [{ name: "課長承認", approverRole: "manager" }, { name: "経理承認", approverRole: "finance" }] };

export function createApprovalNotifier(config: { slackWebhook: string; smtp: Parameters<typeof createSmtpTransport>[0]; from: string; directory: ApproverDirectory }) {
  const notifier = createNotifier([createSlackChannel(config.slackWebhook)]);
  const mailer = createMailer({ transport: createSmtpTransport(config.smtp), from: config.from });

  return async function approveAndNotify(state: WorkflowState, actor: Actor, title: string): Promise<WorkflowState> {
    const res = approve(FLOW, state, actor);
    if (!res.ok) throw res.error;

    // 状態遷移の通知(完了/進行)
    const n = notificationForTransition(state, res.value, { title });
    if (n) await notifier.notify(n);

    // まだ pending なら、次の承認者へ個別に依頼を送る
    for (const person of approverRecipients(FLOW, res.value, config.directory)) {
      if (person.email) await mailer.sendMail({ to: person.email, subject: `【要承認】${title}`, text: `${title} の承認をお願いします。` });
    }
    return res.value;
  };
}
