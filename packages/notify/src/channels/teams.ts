/**
 * Microsoft Teams Incoming Webhook チャネル。
 * @packageDocumentation
 */
import type { NotifyChannel } from "../index.js";

/**
 * Teams チャネルを作る。
 * @param webhookUrl Teams Incoming Webhook URL
 */
export function createTeamsChannel(webhookUrl: string): NotifyChannel {
  const color = { info: "0076D7", warn: "F2C744", error: "D7263D" };
  return {
    async send(message) {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          "@type": "MessageCard",
          "@context": "http://schema.org/extensions",
          themeColor: message.level ? color[message.level] : "0076D7",
          text: message.text,
        }),
      });
      if (!res.ok) throw new Error(`Teams webhook failed: ${res.status}`);
    },
  };
}
