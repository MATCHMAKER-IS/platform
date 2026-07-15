/**
 * チャネルのリトライとフォールバック。一時障害を吸収し、主チャネル障害時は副チャネルへ切り替える。
 * すべて NotifyChannel を返すので相互に合成できる(dedup とも組み合わせ可)。
 * @packageDocumentation
 */
import { defaultShouldRetry } from "@platform/core";
import type { NotifyChannel, NotifyMessage } from "./index.js";

/** リトライ設定。 */
export interface RetryOptions {
  /** 最大リトライ回数(既定 2)。 */
  retries?: number;
  /** n 回目失敗後の待機 ms(既定: 指数 200,400,800...)。 */
  backoffMs?: (attempt: number) => number;
  /** リトライすべきエラーか(既定: 常に true)。 */
  shouldRetry?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
}

/** チャネルをリトライでラップする。失敗時は backoff して再試行、最終的に失敗なら throw。 */
export function withRetry(channel: NotifyChannel, options: RetryOptions = {}): NotifyChannel {
  const retries = options.retries ?? 2;
  const backoffMs = options.backoffMs ?? ((n: number) => 200 * 2 ** (n - 1));
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  return {
    async send(message: NotifyMessage) {
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          await channel.send(message);
          return;
        } catch (e) {
          lastError = e;
          if (attempt < retries && shouldRetry(e)) { await sleep(backoffMs(attempt + 1)); continue; }
          break;
        }
      }
      throw lastError;
    },
  };
}

/** フォールバック設定。 */
export interface FallbackOptions {
  /** チャネル切替が起きた時のコールバック(監視用)。 */
  onFallback?: (failedIndex: number, error: unknown) => void;
}

/**
 * 複数チャネルを順に試し、最初に成功したもので確定する(主→副→…)。
 * 全て失敗した場合のみ、最後のエラーを throw する。
 *
 * @example
 * ```ts
 * const channel = createFallbackChannel([slack, email]); // Slack 失敗時は email
 * ```
 */
export function createFallbackChannel(channels: NotifyChannel[], options: FallbackOptions = {}): NotifyChannel {
  if (channels.length === 0) throw new Error("フォールバックには 1 つ以上のチャネルが必要です");
  return {
    async send(message: NotifyMessage) {
      let lastError: unknown;
      for (let i = 0; i < channels.length; i++) {
        try {
          await channels[i]!.send(message);
          return;
        } catch (e) {
          lastError = e;
          options.onFallback?.(i, e);
        }
      }
      throw lastError;
    },
  };
}
