/**
 * メモリ SMS Transport。実際には送らず送信内容を配列に記録する。
 * @packageDocumentation
 */
import type { SmsMessage, SmsTransport } from "../index";

/** 記録機能付きのメモリ Transport。 */
export interface MemorySmsTransport extends SmsTransport {
  readonly sent: SmsMessage[];
  clear(): void;
}

/**
 * メモリ Transport を作る。
 * @returns 送信内容を貯める {@link MemorySmsTransport}
 */
export function createMemoryTransport(): MemorySmsTransport {
  const sent: SmsMessage[] = [];
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
