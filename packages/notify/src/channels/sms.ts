/**
 * SMS 通知チャネル。`@platform/sms`(相当)を NotifyChannel に適合させる。
 * @packageDocumentation
 */
import type { NotifyChannel } from "../index.js";

/** send が Result を返す最小の SMS 送信インターフェース。 */
export interface SmsLike {
  send(m: { to: string; body: string }): Promise<{ ok: boolean; error?: { message: string } }>;
}

/** SMS 通知チャネルを作る。 */
export function createSmsChannel(sms: SmsLike, options: { to: string }): NotifyChannel {
  return {
    async send(message) {
      const res = await sms.send({ to: options.to, body: message.text });
      if (!res.ok) throw new Error(res.error?.message ?? "SMS送信に失敗しました");
    },
  };
}
