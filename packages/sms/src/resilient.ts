/**
 * SMS Transport のリトライとフォールバック。一時障害を吸収し、主業者の障害時は副業者へ。
 * SmsTransport を返すので createSms にそのまま渡せて合成可能(notify/storage と同一パターン)。
 * @packageDocumentation
 */
import { defaultShouldRetry } from "@platform/core";
import type { SmsTransport, SmsMessage } from "./index";

type SendArg = Required<Pick<SmsMessage, "from">> & SmsMessage;

/** リトライ設定。 */
export interface SmsRetryOptions {
  retries?: number;
  backoffMs?: (attempt: number) => number;
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Transport をリトライでラップする。
 *
 *
 * @param transport 元の送信
 * @param options.attempts 最大試行回数
 * @returns ラップした送信(**恒久エラーは再試行しない**)
 */
export function withSmsRetry(transport: SmsTransport, options: SmsRetryOptions = {}): SmsTransport {
  const retries = options.retries ?? 2;
  const backoffMs = options.backoffMs ?? ((n: number) => 200 * 2 ** (n - 1));
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  return {
    async send(message: SendArg) {
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try { await transport.send(message); return; }
        catch (e) { lastError = e; if (attempt < retries && shouldRetry(e)) { await sleep(backoffMs(attempt + 1)); continue; } break; }
      }
      throw lastError;
    },
  };
}

/** フォールバック設定。 */
export interface SmsFallbackOptions { onFallback?: (failedIndex: number, error: unknown) => void }

/**
 * 複数業者を順に試し、最初に成功したもので確定(主→副→…)。全失敗時のみ throw。
 *
 *
 * @param transports 送信の配列(優先順)
 * @returns ラップした送信
 * @throws 全部失敗した場合
 */
export function createFallbackSmsTransport(transports: SmsTransport[], options: SmsFallbackOptions = {}): SmsTransport {
  if (transports.length === 0) throw new Error("フォールバックには 1 つ以上の Transport が必要です");
  return {
    async send(message: SendArg) {
      let lastError: unknown;
      for (let i = 0; i < transports.length; i++) {
        try { await transports[i]!.send(message); return; }
        catch (e) { lastError = e; options.onFallback?.(i, e); }
      }
      throw lastError;
    },
  };
}
