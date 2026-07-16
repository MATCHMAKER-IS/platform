/**
 * `@platform/line` — LINE Messaging API クライアント。
 *
 * push / multicast / broadcast / reply / プロフィール取得を型付きで扱う。
 * 単純な通知だけなら `@platform/notify` の LINE チャネルで十分。こちらは
 * 個別ユーザーへの push や応答など、より踏み込んだ操作向け。
 * チャネルアクセストークンの取得・更新はアプリ側の責務。
 *
 * @packageDocumentation
 */

import { createApiClient } from "@platform/integrations";
import type { Result } from "@platform/core";

/** LINE のメッセージオブジェクト(text 以外も渡せるよう緩めに型付け)。 */
export interface LineMessage {
  type: "text" | "sticker" | "image" | "flex" | string;
  [key: string]: unknown;
}

/** LINE プロフィール。 */
export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

/** LINE クライアント。 */
export interface LineClient {
  /** 単一ユーザー/グループへ push する。 */
  push(to: string, messages: LineMessage[]): Promise<Result<unknown>>;
  /** テキストを push する簡易版。 */
  pushText(to: string, text: string): Promise<Result<unknown>>;
  /** 複数ユーザーへ multicast する。 */
  multicast(to: string[], messages: LineMessage[]): Promise<Result<unknown>>;
  /** 全友だちへ broadcast する。 */
  broadcast(messages: LineMessage[]): Promise<Result<unknown>>;
  /** 応答トークンで返信する。 */
  reply(replyToken: string, messages: LineMessage[]): Promise<Result<unknown>>;
  /** ユーザープロフィールを取得する。 */
  getProfile(userId: string): Promise<Result<LineProfile>>;
  /** グループ内メンバーのプロフィールを取得する。 */
  getGroupMemberProfile(groupId: string, userId: string): Promise<Result<LineProfile>>;
  /** リッチメニューを作成し、リッチメニュー ID を返す。 */
  createRichMenu(richMenu: Record<string, unknown>): Promise<Result<{ richMenuId: string }>>;
  /** ユーザーにリッチメニューをリンクする。 */
  linkRichMenu(userId: string, richMenuId: string): Promise<Result<unknown>>;
  /** デフォルトのリッチメニューを設定する(全ユーザー)。 */
  setDefaultRichMenu(richMenuId: string): Promise<Result<unknown>>;
  /** リッチメニューを削除する。 */
  deleteRichMenu(richMenuId: string): Promise<Result<unknown>>;
  /** チャットにローディングアニメーションを表示する(応答準備中の演出)。 */
  showLoadingAnimation(chatId: string, seconds?: number): Promise<Result<unknown>>;
  /** 当月の push メッセージ利用状況(上限・消費数)を取得する。 */
  getMessageQuota(): Promise<Result<{ type: string; value?: number }>>;
}

/**
 * LINE クライアントを作る。
 * @param config `channelAccessToken` … LINE Messaging API のチャネルアクセストークン
 * @returns {@link LineClient}
 *
 * @example
 * ```ts
 * const line = createLineClient({ channelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN });
 * await line.pushText("U1234...", "承認されました");
 * ```
 */
export function createLineClient(config: { channelAccessToken: string; fetchImpl?: typeof fetch }): LineClient {
  const api = createApiClient({
    baseUrl: "https://api.line.me/v2/bot",
    headers: { Authorization: `Bearer ${config.channelAccessToken}` },
    fetchImpl: config.fetchImpl,
  });
  return {
    push: (to, messages) => api.post("/message/push", { body: { to, messages } }),
    pushText: (to, text) => api.post("/message/push", { body: { to, messages: [{ type: "text", text }] } }),
    multicast: (to, messages) => api.post("/message/multicast", { body: { to, messages } }),
    broadcast: (messages) => api.post("/message/broadcast", { body: { messages } }),
    reply: (replyToken, messages) => api.post("/message/reply", { body: { replyToken, messages } }),
    getProfile: (userId) => api.get<LineProfile>(`/profile/${encodeURIComponent(userId)}`),
    getGroupMemberProfile: (groupId, userId) =>
      api.get<LineProfile>(`/group/${encodeURIComponent(groupId)}/member/${encodeURIComponent(userId)}`),
    createRichMenu: (richMenu) => api.post<{ richMenuId: string }>("/richmenu", { body: richMenu }),
    linkRichMenu: (userId, richMenuId) =>
      api.post(`/user/${encodeURIComponent(userId)}/richmenu/${encodeURIComponent(richMenuId)}`, { body: {} }),
    setDefaultRichMenu: (richMenuId) =>
      api.post(`/user/all/richmenu/${encodeURIComponent(richMenuId)}`, { body: {} }),
    deleteRichMenu: (richMenuId) => api.delete(`/richmenu/${encodeURIComponent(richMenuId)}`),
    showLoadingAnimation: (chatId, seconds = 20) =>
      api.post("/chat/loading/start", { body: { chatId, loadingSeconds: seconds } }),
    getMessageQuota: () => api.get<{ type: string; value?: number }>("/message/quota"),
  };
}

/** LINE 宛先の種別。 */
export type LineRecipientType = "user" | "group" | "room" | "unknown";

/**
 * LINE の宛先 ID から種別を判定する。
 *
 * **接頭辞で分かる**(`U` = ユーザー、`C` = グループ、`R` = ルーム)。
 * 種別で使える API が違うので、送る前に確認する。
 *
 * @param id 宛先 ID
 * @returns 種別。**判定できなければ null**
 */
export function lineRecipientType(id: string): LineRecipientType {
  if (/^U[0-9a-f]{32}$/i.test(id)) return "user";
  if (/^C[0-9a-f]{32}$/i.test(id)) return "group";
  if (/^R[0-9a-f]{32}$/i.test(id)) return "room";
  return "unknown";
}

/**
 * LINE の宛先 ID として妥当かを判定する。
 *
 * @param id 宛先 ID
 * @returns 妥当なら true
 */
export function isValidLineRecipient(id: string): boolean {
  return lineRecipientType(id) !== "unknown";
}

export * from "./messages";
export * from "./webhook";
