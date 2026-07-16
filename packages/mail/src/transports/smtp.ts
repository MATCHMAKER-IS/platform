/**
 * SMTP 用 Transport。nodemailer をこのファイル内だけで使い、
 * 上位(アプリ)から nodemailer を隠蔽する。
 * @packageDocumentation
 */
import nodemailer from "nodemailer";
import type { MailTransport } from "../index";

/** SMTP 接続設定。 */
export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
}

/**
 * SMTP Transport を作る。
 * @param config 接続設定
 * @returns {@link MailTransport} 実装
 */
export function createSmtpTransport(config: SmtpConfig): MailTransport {
  const t = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  return {
    async send(message) {
      await t.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
  };
}
