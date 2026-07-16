/**
 * メール通知チャネル。`@platform/mail` の Mailer(相当)を NotifyChannel に適合させる。
 * @packageDocumentation
 */
import type { NotifyChannel, NotifyMessage } from "../index";

/** send が Result を返す最小のメール送信インターフェース。 */
export interface MailerLike {
  sendMail(m: { to: string | string[]; subject: string; text?: string }): Promise<{ ok: boolean; error?: { message: string } }>;
}

/**
 * メール通知チャネルを作る。件名は固定 or level から決める。
 *
 *
 * @param options 送信の設定
 * @returns メール のチャネル。**`@platform/mail` の Transport を包む**ので、送信業者は差し替えられる
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — 送信に失敗した場合(`send` 実行時)
 */
export function createMailChannel(mailer: MailerLike, options: { to: string | string[]; subject?: string | ((level: NotifyMessage["level"]) => string) }): NotifyChannel {
  return {
    async send(message) {
      const subject = typeof options.subject === "function" ? options.subject(message.level) : options.subject ?? `[通知] ${message.level ?? "info"}`;
      const res = await mailer.sendMail({ to: options.to, subject, text: message.text });
      if (!res.ok) throw new Error(res.error?.message ?? "メール送信に失敗しました");
    },
  };
}
