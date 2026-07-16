/**
 * LINE 通知チャネル。`@platform/line`(相当)を NotifyChannel に適合させる。
 * @packageDocumentation
 */
import type { NotifyChannel } from "../index.js";

/** push が Result を返す最小の LINE クライアントインターフェース。 */
export interface LineLike {
  pushMessage(to: string, m: { text: string }): Promise<{ ok: boolean; error?: { message: string } }>;
}

/**
 * LINE 通知チャネルを作る。
 *
 *
 * @param options 送信の設定
 * @returns LINE のチャネル。**push は課金対象**(reply は無料だが 1 回・短時間のみ)
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — 送信に失敗した場合(`send` 実行時)
 */
export function createLineChannel(client: LineLike, options: { to: string }): NotifyChannel {
  return {
    async send(message) {
      const res = await client.pushMessage(options.to, { text: message.text });
      if (!res.ok) throw new Error(res.error?.message ?? "LINE送信に失敗しました");
    },
  };
}

/** 実 LINE クライアント(`@platform/line` 相当)の最小インターフェース。 */
export interface LineClientLike {
  pushText(to: string, text: string): Promise<{ ok: boolean; error?: { message: string } }>;
}

/**
 * 実 LINE クライアント(pushText)から通知チャネルを作る。
 *
 *
 * @param options 送信の設定
 * @returns LINE(クライアント注入版) のチャネル。**テストでモックできる**
 * @throws {@link @platform/core#AppError} コード `EXTERNAL` — 送信に失敗した場合(`send` 実行時)
 */
export function createLineClientChannel(client: LineClientLike, options: { to: string }): NotifyChannel {
  return {
    async send(message) {
      const res = await client.pushText(options.to, message.text);
      if (!res.ok) throw new Error(res.error?.message ?? "LINE送信に失敗しました");
    },
  };
}
