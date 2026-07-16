/**
 * 通知の実チャネル接続(アダプタ)。@platform/notify の NotifyChannel として
 * メール(@platform/mail)・Slack(Webhook)・LINE を送れるようにする。
 * 送信の実体は注入し、外部依存を疎結合に保つ。
 * @packageDocumentation
 */
import { type NotifyChannel, type NotifyMessage } from "@platform/notify";
import { type Mailer } from "@platform/mail";

/** メール通知チャネル。level に応じて件名を付ける。 */
export function mailChannel(mailer: Mailer, to: string | string[], options: { subjectPrefix?: string } = {}): NotifyChannel {
  return {
    async send(message: NotifyMessage) {
      const prefix = options.subjectPrefix ?? "通知";
      const levelTag = message.level === "error" ? "【重要】" : message.level === "warn" ? "【注意】" : "";
      const result = await mailer.sendMail({ to, subject: `${levelTag}${prefix}`, text: message.text });
      if (!result.ok) throw new Error("メール送信に失敗しました");
    },
  };
}

/** Slack Webhook 通知チャネル。post は fetch などを注入。 */
export function slackChannel(
  webhookUrl: string,
  post: (url: string, body: { text: string }) => Promise<{ ok: boolean }>,
): NotifyChannel {
  return {
    async send(message: NotifyMessage) {
      const emoji = message.level === "error" ? ":rotating_light: " : message.level === "warn" ? ":warning: " : "";
      const result = await post(webhookUrl, { text: `${emoji}${message.text}` });
      if (!result.ok) throw new Error("Slack 送信に失敗しました");
    },
  };
}

/** LINE 通知チャネル。pushText は LINE のプッシュ送信を注入。 */
export function lineChannel(
  to: string,
  pushText: (to: string, text: string) => Promise<{ ok: boolean }>,
): NotifyChannel {
  return {
    async send(message: NotifyMessage) {
      const result = await pushText(to, message.text);
      if (!result.ok) throw new Error("LINE 送信に失敗しました");
    },
  };
}
