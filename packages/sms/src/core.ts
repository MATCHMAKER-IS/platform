/**
 * SMS の中核(送信の組み立てと Transport の契約)。**外部 SDK に触れない。**
 *
 * バレル(`index.ts`)から切り出してある。バレルは Twilio SDK を再 export するため、
 * ブラウザ向けの入口(`browser.ts`)がバレルを経由すると
 * **twilio ごと引き込まれて `next build` が落ちる**。
 * 中核をここに置き、バレルとブラウザ入口の両方がここを参照する形にしている。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** 送信する SMS。 */
export interface SmsMessage {
  /** 宛先電話番号(E.164 形式推奨: 例 "+819012345678")。 */
  to: string;
  /** 本文。 */
  body: string;
  /** 送信元番号。省略時は Transport の既定を使う。 */
  from?: string;
}

/** SMS 送信基盤の抽象(Adapter)。 */
export interface SmsTransport {
  send(message: Required<Pick<SmsMessage, "from">> & SmsMessage): Promise<void>;
}

/** {@link createSms} のオプション。 */
export interface SmsOptions {
  transport: SmsTransport;
  /** from 未指定時に使う既定送信元番号。 */
  defaultFrom: string;
}

/** アプリが使う SMS 送信口。 */
export interface Sms {
  /**
   * SMS を送信する。失敗は例外ではなく {@link @platform/core#Result} で返す。
   * @param message 送信する SMS
   * @returns 成功なら `ok`、失敗なら `EXTERNAL` の `err`
   */
  sendSms(message: SmsMessage): Promise<Result<void>>;
}

/**
 * Transport を注入して Sms を作る。
 *
 * @param options Transport と既定送信元
 * @returns アプリ向けの {@link Sms}
 *
 * @example
 * ```ts
 * const sms = createSms({
 *   transport: createTwilioTransport({ accountSid, authToken }),
 *   defaultFrom: "+815012345678",
 * });
 * await sms.sendSms({ to: "+819012345678", body: "認証コード: 1234" });
 * ```
 */
export function createSms(options: SmsOptions): Sms {
  const { transport, defaultFrom } = options;
  return {
    async sendSms(message) {
      const res = await tryCatch(() =>
        transport.send({ ...message, from: message.from ?? defaultFrom }),
      );
      if (res.ok) return res;
      return {
        ok: false,
        error: new AppError(ErrorCode.EXTERNAL, "SMS送信に失敗しました", {
          cause: res.error.cause ?? res.error,
          details: { to: message.to },
        }),
      };
    },
  };
}
