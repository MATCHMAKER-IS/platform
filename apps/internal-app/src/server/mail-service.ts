/**
 * メール送信の口。実際の送信は @platform/mail に Transport を注入して行う。
 * この環境では SMTP を利用できないため、Transport が設定されていなければ null を返す。
 * @packageDocumentation
 */
import { createMailer, type Mailer, type MailTransport } from "@platform/mail";

const DEFAULT_FROM = "no-reply@example.com";

/** 環境から Transport を解決する。未設定なら null（送信不可）。 */
export function resolveMailTransport(): MailTransport | null {
  // 実運用では createSmtpTransport({...}) 等をここで返す。
  return null;
}

/** Transport が設定されていれば Mailer を返す。 */
export function getMailer(transport: MailTransport | null = resolveMailTransport()): Mailer | null {
  return transport ? createMailer({ transport, defaultFrom: DEFAULT_FROM }) : null;
}
