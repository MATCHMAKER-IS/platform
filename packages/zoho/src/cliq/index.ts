/**
 * `@platform/zoho/cliq` — Zoho Cliq API(v2)クライアント。
 * ベースは `cliq.zoho.{dc}/api/v2`。チャンネル/チャット/ボットへのメッセージ送信等。
 * @packageDocumentation
 */
import type { Result } from "@platform/core";
import { createZohoApiClient } from "../core/client.js";
import { serviceBaseUrl, type ZohoDataCenter } from "../core/datacenter.js";

/** Cliq レスポンス(緩め)。 */
export type CliqRecord = Record<string, unknown>;

/** Cliq クライアント設定。 */
export interface ZohoCliqConfig { dataCenter: ZohoDataCenter; accessToken: string; fetchImpl?: typeof fetch }

/** Cliq クライアント。 */
export interface ZohoCliqClient {
  listChannels(params?: { limit?: number; joined?: boolean }): Promise<Result<CliqRecord>>;
  getChannel(channelId: string): Promise<Result<CliqRecord>>;
  createChannel(channel: { name: string; level?: string; team_ids?: string[]; user_ids?: string[]; description?: string }): Promise<Result<CliqRecord>>;
  addChannelMembers(channelId: string, emailIds: string[]): Promise<Result<CliqRecord>>;
  removeChannelMembers(channelId: string, emailIds: string[]): Promise<Result<CliqRecord>>;
  /** チャンネルにメッセージ投稿。 */
  postToChannel(channelId: string, text: string, extra?: CliqRecord): Promise<Result<CliqRecord>>;
  /** チャンネル(ユニーク名)にメッセージ投稿。 */
  postToChannelByName(channelUniqueName: string, text: string, extra?: CliqRecord): Promise<Result<CliqRecord>>;
  /** ダイレクト(チャット)にメッセージ投稿。 */
  postToChat(chatId: string, text: string, extra?: CliqRecord): Promise<Result<CliqRecord>>;
  /** ボット経由でメッセージ投稿。 */
  postToBot(botUniqueName: string, text: string, extra?: CliqRecord): Promise<Result<CliqRecord>>;
  listUsers(params?: { limit?: number }): Promise<Result<CliqRecord>>;
  listBuddies(): Promise<Result<CliqRecord>>;
}

/**
 * Zoho Cliq(チャット)のクライアントを作る。
 *
 * @param config.tokenManager トークンマネージャ(**自動更新される**)
 * @param config.dc データセンター(**契約時の DC を指定**。間違えると 404 になる)
 * @param config.fetchImpl fetch の実装(テスト注入用)
 * @returns Cliq のクライアント。**すべてのメソッドは Result 型を返す**(例外を投げない)
 */
export function createZohoCliqClient(config: ZohoCliqConfig): ZohoCliqClient {
  const api = createZohoApiClient({ apiDomain: serviceBaseUrl("cliq", config.dataCenter), basePath: "", accessToken: config.accessToken, fetchImpl: config.fetchImpl });
  const enc = encodeURIComponent;
  const msg = (text: string, extra?: CliqRecord) => ({ text, ...extra });
  return {
    listChannels: (p) => api.get(`/channels`, { query: { limit: p?.limit, joined: p?.joined } }),
    getChannel: (id) => api.get(`/channels/${enc(id)}`),
    createChannel: (channel) => api.post(`/channels`, { body: channel }),
    addChannelMembers: (id, emailIds) => api.post(`/channels/${enc(id)}/members`, { body: { email_ids: emailIds } }),
    removeChannelMembers: (id, emailIds) => api.delete(`/channels/${enc(id)}/members`, { body: { email_ids: emailIds } }),
    postToChannel: (id, text, extra) => api.post(`/channels/${enc(id)}/message`, { body: msg(text, extra) }),
    postToChannelByName: (name, text, extra) => api.post(`/channelsbyname/${enc(name)}/message`, { body: msg(text, extra) }),
    postToChat: (chatId, text, extra) => api.post(`/chats/${enc(chatId)}/message`, { body: msg(text, extra) }),
    postToBot: (botName, text, extra) => api.post(`/bots/${enc(botName)}/message`, { body: msg(text, extra) }),
    listUsers: (p) => api.get(`/users`, { query: { limit: p?.limit } }),
    listBuddies: () => api.get(`/buddies`),
  };
}
