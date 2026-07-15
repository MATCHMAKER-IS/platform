/**
 * メンション受信箱。ユーザー宛（@handle）の未読メンションを集計・一覧する。
 * @platform/chat の unreadMentionsOf に委譲し、履歴ストアと既読から算出する。
 * @packageDocumentation
 */
import { unreadMentionsOf, sortMessages, type ChatMessage } from "@platform/chat";
import { type ChatStore } from "./chat-store.js";
import { type RoomRepository } from "./chat-rooms.js";

/** メンション 1 件（一覧表示用）。 */
export interface MentionItem {
  messageId: string;
  roomId: string;
  senderId: string;
  text: string;
  at: string;
}

/** メンション受信箱。 */
export interface MentionInbox {
  /** 未読メンション件数（所属ルーム横断）。 */
  unreadCount(userId: string, handle: string): Promise<number>;
  /** 未読メンション一覧（新しい順）。 */
  unread(userId: string, handle: string, limit?: number): Promise<MentionItem[]>;
}

/** メンション受信箱を作る。 */
export function createMentionInbox(deps: { store: ChatStore; roomRepo: RoomRepository }): MentionInbox {
  const collect = async (userId: string, handle: string): Promise<ChatMessage[]> => {
    const roomIds = await deps.roomRepo.roomIdsForUser(userId);
    const all: ChatMessage[] = [];
    for (const roomId of roomIds) {
      const msgs = await deps.store.recent(roomId);
      const lastRead = await deps.store.lastRead(userId, roomId);
      all.push(...unreadMentionsOf(msgs, handle, lastRead));
    }
    return sortMessages(all).reverse(); // 新しい順
  };
  return {
    async unreadCount(userId, handle) {
      return (await collect(userId, handle)).length;
    },
    async unread(userId, handle, limit = 50) {
      const items = await collect(userId, handle);
      return items.slice(0, limit).map((m) => ({ messageId: m.id, roomId: m.roomId, senderId: m.senderId, text: m.text, at: m.at }));
    },
  };
}
