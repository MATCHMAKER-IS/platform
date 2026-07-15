/**
 * Slack Incoming Webhook チャネル。
 * @packageDocumentation
 */
import type { NotifyChannel } from "../index.js";

/**
 * Slack チャネルを作る。
 * @param webhookUrl Slack Incoming Webhook URL
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
