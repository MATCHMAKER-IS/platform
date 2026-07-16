/**
 * Twilio 用 SMS Transport。twilio SDK をこのファイル内だけで使い、隠蔽する。
 * @packageDocumentation
 */
import twilio from "twilio";
import type { SmsTransport } from "../index";

/** Twilio 接続設定。 */
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
}

/**
 * Twilio Transport を作る。
 * @param config 接続設定
 * @returns {@link SmsTransport} 実装
 */
export function createTwilioTransport(config: TwilioConfig): SmsTransport {
  const client = twilio(config.accountSid, config.authToken);
  return {
    async send(message) {
      await client.messages.create({ to: message.to, from: message.from, body: message.body });
    },
  };
}
