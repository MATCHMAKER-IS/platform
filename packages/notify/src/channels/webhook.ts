/**
 * 汎用 Webhook チャネル。任意の URL へ JSON を POST する。
 * @packageDocumentation
 */
import type { NotifyChannel, NotifyMessage } from "../index.js";

/**
 * 汎用 Webhook チャネルを作る。
 * @param url 送信先 URL
 * @param format メッセージ→ペイロード変換(既定: `{ text, level }`)
 *
 * @param options 送信の設定
 * @returns Webhook のチャネル。**任意の URL に POST する**(受け手側で自由に処理できる)
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — 送信に失敗した場合(`send` 実行時)
 */
export function createWebhookChannel(url: string, format?: (m: NotifyMessage) => unknown): NotifyChannel {
  return {
    async send(message) {
      const body = format ? format(message) : { text: message.text, level: message.level ?? "info" };
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Webhook 送信失敗: ${res.status}`);
    },
  };
}

/**
 * Discord Webhook チャネル(content フィールドに送る)。
 *
 *
 * @param options 送信の設定
 * @returns Discord のチャネル。**Webhook URL を使う**
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — 送信に失敗した場合(`send` 実行時)
 */
export function createDiscordChannel(webhookUrl: string): NotifyChannel {
  return createWebhookChannel(webhookUrl, (m) => ({ content: `${m.level === "error" ? "🚨 " : m.level === "warn" ? "⚠️ " : ""}${m.text}` }));
}
