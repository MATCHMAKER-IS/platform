/**
 * メール Transport のリトライとフォールバック。一時障害を吸収し、主業者の障害時は副業者へ。
 * MailTransport を返すので createMailer にそのまま渡せて合成可能(notify/storage と同一パターン)。
 * @packageDocumentation
 */
import { defaultShouldRetry } from "@platform/core";
import type { MailTransport, MailMessage } from "./index.js";

type SendArg = Required<Pick<MailMessage, "from">> & MailMessage;

/** リトライ設定。 */
export interface MailRetryOptions {
  retries?: number;
  backoffMs?: (attempt: number) => number;
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

/** Transport をリトライでラップする。 */
export function withMailRetry(transport: MailTransport, options: MailRetryOptions = {}): MailTransport {
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
export interface MailFallbackOptions { onFallback?: (failedIndex: number, error: unknown) => void }

/** 複数業者(SMTP→SES 等)を順に試し、最初に成功したもので確定。全失敗時のみ throw。 */
export function createFallbackMailTransport(transports: MailTransport[], options: MailFallbackOptions = {}): MailTransport {
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
