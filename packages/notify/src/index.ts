/**
 * `@platform/notify` — チャット通知の共通部品(Adapter パターン)。
 *
 * Slack / Teams / LINE などへ「業務イベントの通知」を送る。
 * 送信先チャネルを差し替えても呼び出し側は無変更。複数チャネルへ同報もできる。
 *
 * @packageDocumentation
 */

import { AppError, ErrorCode, tryCatch, type Result } from "@platform/core";

/** 通知メッセージ。 */
export interface NotifyMessage {
  /** 本文。 */
  text: string;
  /** 重要度(チャネル側で色分け等に使える)。 */
  level?: "info" | "warn" | "error";
}

/** 通知チャネルの抽象(Adapter)。 */
export interface NotifyChannel {
  send(message: NotifyMessage): Promise<void>;
}

/** アプリが使う通知口。 */
export interface Notifier {
  /**
   * 登録済みの全チャネルへ通知する。1 つでも失敗すれば `EXTERNAL` の err。
   * @param message 通知内容
   */
  notify(message: NotifyMessage): Promise<Result<void>>;
}

/**
 * チャネル群を束ねて Notifier を作る。
 * @param channels 送信先チャネル(1 つ以上)
 * @returns {@link Notifier}
 *
 * @example
 * ```ts
 * const notifier = createNotifier([createSlackChannel(webhookUrl)]);
 * await notifier.notify({ text: "バッチが失敗しました", level: "error" });
 * ```
 */
export function createNotifier(channels: NotifyChannel[]): Notifier {
  return {
    async notify(message) {
      const res = await tryCatch(() => Promise.all(channels.map((c) => c.send(message))));
      if (res.ok) return { ok: true, value: undefined };
      return {
        ok: false,
        error: new AppError(ErrorCode.EXTERNAL, "通知の送信に失敗しました", {
          cause: res.error.cause ?? res.error,
        }),
      };
    },
  };
}

export { createSlackChannel } from "./channels/slack.js";
export { createWebhookChannel, createDiscordChannel } from "./channels/webhook.js";
export { renderTemplate } from "./template.js";
export { crossedMilestones } from "./progress.js";
export { createTeamsChannel } from "./channels/teams.js";
export { createLineChannel } from "./channels/line.js";

export { createMailChannel, type MailerLike } from "./channels/mail.js";
export { createSmsChannel, type SmsLike } from "./channels/sms.js";
export { notifyAllSettled, summarizeResults, type ChannelResult, type NamedChannel } from "./fanout.js";
export { withDedup, createMemorySeenStore, type SeenStore, type DedupOptions } from "./dedup.js";
export { withRetry, createFallbackChannel, type RetryOptions, type FallbackOptions } from "./resilient.js";
export { createRedisSeenStore, type RedisSeenClient, type AsyncSeenStore } from "./seen-redis.js";
export * from "./preferences.js";
