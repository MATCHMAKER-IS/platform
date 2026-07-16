/**
 * Microsoft Teams Incoming Webhook チャネル。
 * @packageDocumentation
 */
import type { NotifyChannel } from "../index";

/**
 * Teams チャネルを作る。
 * @param webhookUrl Teams Incoming Webhook URL
 *
 * @param options 送信の設定
 * @returns Teams のチャネル。**Incoming Webhook を使う**
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — 送信に失敗した場合(`send` 実行時)
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
