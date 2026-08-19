/**
 * `@platform/mail` — メール送信の共通部品(Adapter パターン)。
 *
 * アプリは送信基盤(SMTP か Resend か)を意識せず、`createMailer()` が返す Mailer の `sendMail` を呼ぶ。
 * 裏の実装は差し替え可能で、切り替えてもアプリ側は無変更。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** 1 通のメール。 */
export interface MailMessage {
  /**
   * 宛先(複数可)。
   *
   * **一斉配信に配列を渡さない。** `to` に入れた宛先は
   * **受信者全員に見える**——社外(顧客・取引先)へ送れば
   * **そのまま個人情報の漏洩事故**になる。
   * 日本の業務システムで最も多い事故の 1 つ。
   *
   * 一斉配信は {@link bcc} を使うこと(2026-08 に追加)。
   */
  to: string | string[];
  /**
   * 表に出さない宛先(一斉配信用)。
   *
   * **受信者からは他の宛先が見えない。** 社内のお知らせ・顧客への案内など、
   * **相手どうしが互いを知らない配信**では必ずこちらを使う。
   *
   * `to` を自分(送信元)にして `bcc` に全員を入れるのが定石。
   * `to` を空にすると**受信側で迷惑メール判定されやすい**。
   */
  bcc?: string | string[];
  /** 表に出す控えの宛先(上長への写しなど。**受信者全員に見える**)。 */
  cc?: string | string[];
  /** 件名。 */
  subject: string;
  /** 本文(テキスト)。 */
  text?: string;
  /** 本文(HTML)。 */
  html?: string;
  /** 差出人。省略時は Transport の既定 from を使う。 */
  from?: string;
  /** 添付ファイル。 */
  attachments?: MailAttachment[];
  /** 追加ヘッダ(List-Unsubscribe 等)。 */
  headers?: Record<string, string>;
}

/** メール添付ファイル。 */
export interface MailAttachment {
  /** ファイル名(表示名)。 */
  filename: string;
  /** 内容。base64 文字列またはバイト列。 */
  content: string | Uint8Array;
  /** MIME タイプ(例 "application/pdf")。省略時は拡張子から推定される想定。 */
  contentType?: string;
  /** content が base64 文字列かどうか(既定: 文字列なら true)。 */
  encoding?: "base64" | "binary";
  /** インライン画像として埋め込む場合の Content-ID(HTML から cid:xxx で参照)。 */
  cid?: string;
}

/**
 * メール送信基盤の抽象(Adapter)。
 * 新しい送信元(SES 等)を足すときはこのインターフェースを実装するだけでよい。
 */
export interface MailTransport {
  /** 実際に 1 通送信する。 */
  send(message: Required<Pick<MailMessage, "from">> & MailMessage): Promise<void>;
}

/** {@link createMailer} のオプション。 */
export interface MailerOptions {
  /** 使用する Transport 実装。 */
  transport: MailTransport;
  /** from 未指定時に使う既定差出人。 */
  defaultFrom: string;
}

/** アプリが使うメール送信口。 */
export interface Mailer {
  /**
   * メールを送信する。失敗は例外ではなく {@link @platform/core#Result} で返す。
   * @param message 送信するメール
   * @returns 成功なら `ok`、失敗なら `EXTERNAL` コードの `err`
   */
  sendMail(message: MailMessage): Promise<Result<void>>;
}

/**
 * Transport を注入して Mailer を作る。
 *
 * @param options Transport と既定 from
 * @returns アプリ向けの {@link Mailer}
 *
 * @example
 * ```ts
 * const mailer = createMailer({
 *   transport: createSmtpTransport({ host, port }),
 *   defaultFrom: "no-reply@example.co.jp",
 * });
 * const res = await mailer.sendMail({ to: "a@example.co.jp", subject: "件名", text: "本文" });
 * ```
 */
export function createMailer(options: MailerOptions): Mailer {
  const { transport, defaultFrom } = options;
  return {
    async sendMail(message) {
      const res = await tryCatch(() =>
        transport.send({ ...message, from: message.from ?? defaultFrom }),
      );
      if (res.ok) return res;
      return {
        ok: false,
        error: new AppError(ErrorCode.EXTERNAL, "メール送信に失敗しました", {
          cause: res.error.cause ?? res.error,
          details: { subject: message.subject },
        }),
      };
    },
  };
}

export { createSmtpTransport } from "./transports/smtp";
export { createMemoryTransport, type MemoryTransport } from "./transports/memory";

export * from "./email";
export { withMailRetry, createFallbackMailTransport, type MailRetryOptions, type MailFallbackOptions } from "./resilient";
export * from "./template";
export * from "./allowlist";
export * from "./attachments";
export * from "./unsubscribe";
