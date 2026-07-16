/**
 * メモリ Transport。実際には送らず送信内容を配列に記録する。
 * テストやローカルデバッグで送信内容を検証するのに使う。
 * @packageDocumentation
 */
import type { MailMessage, MailTransport } from "../index";

/** 記録機能付きのメモリ Transport。 */
export interface MemoryTransport extends MailTransport {
  /** これまでに送信された(記録された)メール。 */
  readonly sent: MailMessage[];
  /** 記録をクリアする。 */
  clear(): void;
}

/**
 * メモリ Transport を作る。
 * @returns 送信内容を貯める {@link MemoryTransport}
 * @example
 * ```ts
 * const mem = createMemoryTransport();
 * const mailer = createMailer({ transport: mem, defaultFrom: "x@y.z" });
 * await mailer.sendMail({ to: "a@b.c", subject: "s", text: "t" });
 * expect(mem.sent).toHaveLength(1);
 * ```
 */
export function createMemoryTransport(): MemoryTransport {
  const sent: MailMessage[] = [];
  return {
    sent,
    clear() {
      sent.length = 0;
    },
    async send(message) {
      sent.push(message);
    },
  };
}
