/**
 * Slack Incoming Webhook チャネル。
 * @packageDocumentation
 */
import type { NotifyChannel } from "../index";

/**
 * Slack チャネルを作る。
 * @param webhookUrl Slack Incoming Webhook URL
 *
 * @param options 送信の設定
 * @returns Slack のチャネル。**Incoming Webhook を使う**(Bot トークンより設定が簡単)
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — 送信に失敗した場合(`send` 実行時)
 */
export function createSlackChannel(webhookUrl: string): NotifyChannel {
  const emoji = { info: ":information_source:", warn: ":warning:", error: ":rotating_light:" };
  return {
    async send(message) {
      const prefix = message.level ? `${emoji[message.level]} ` : "";
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: prefix + message.text }),
      });
      if (!res.ok) throw new Error(`Slack webhook failed: ${res.status}`);
    },
  };
}
