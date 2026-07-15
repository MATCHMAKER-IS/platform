/**
 * チャットの履歴・既読の保存。インターフェースは非同期(DB 実装に合わせる)。
 * 開発/単一インスタンスは `createMemoryChatStore`、本番は `createPrismaChatStore`(chat-store-prisma.ts)。
 * 未読数は @platform/chat の `unreadCount`(自分以外・最終既読より後)に委譲する。
 * @packageDocumentation
 */
import { unreadCount, type ChatMessage, type RoomMember } from "@platform/chat";

/** ルーム一覧の 1 行(未読数つき)。 */
export interface RoomUnread {
  roomId: string;
  unread: number;
  /** 直近メッセージの時刻(並べ替え用)。 */
  lastAt?: string;
}

/** 履歴・既読ストア(非同期)。 */
export interface ChatStore {
  /** 送信されたメッセージを記録する。 */
  append(message: ChatMessage): Promise<void>;
  /** 既存メッセージを差し替える(編集)。無ければ何もしない。 */
  update(message: ChatMessage): Promise<void>;
  /** メッセージを削除する。 */
  remove(roomId: string, messageId: string): Promise<void>;
  /** ルームの直近メッセージ(古い→新しい)。 */
  recent(roomId: string): Promise<ChatMessage[]>;
  /** 既読位置を保存する(後退しない)。 */
  markRead(userId: string, roomId: string, at: string): Promise<void>;
  /** 既読位置(未設定なら undefined)。 */
  lastRead(userId: string, roomId: string): Promise<string | undefined>;
  /** ユーザーの、指定ルーム群の未読数。 */
  unreadFor(userId: string, roomIds: string[]): Promise<RoomUnread[]>;
}

/** メッセージ配列から、あるユーザーの未読行を作る(memory/prisma 共通ロジック)。 */
export function toRoomUnread(roomId: string, messages: ChatMessage[], userId: string, lastReadAt: string | undefined): RoomUnread {
  const member: RoomMember = { userId };
  if (lastReadAt) member.lastReadAt = lastReadAt;
  const last = messages[messages.length - 1];
  const row: RoomUnread = { roomId, unread: unreadCount(messages, member) };
  if (last) row.lastAt = last.at;
  return row;
}

/** インメモリ実装を作る(単一インスタンス/開発用)。 */
export function createMemoryChatStore(options: { keepPerRoom?: number } = {}): ChatStore {
  const keep = options.keepPerRoom ?? 500;
  const byRoom = new Map<string, ChatMessage[]>();
  const reads = new Map<string, string>();
  const readKey = (userId: string, roomId: string) => `${userId}\u0000${roomId}`;

  return {
    async append(message) {
      const list = byRoom.get(message.roomId) ?? [];
      list.push(message);
      if (list.length > keep) list.splice(0, list.length - keep);
      byRoom.set(message.roomId, list);
    },
    async update(message) {
      const list = byRoom.get(message.roomId);
      if (!list) return;
      const i = list.findIndex((m) => m.id === message.id);
      if (i >= 0) list[i] = message;
    },
    async remove(roomId, messageId) {
      const list = byRoom.get(roomId);
      if (!list) return;
      const i = list.findIndex((m) => m.id === messageId);
      if (i >= 0) list.splice(i, 1);
    },
    async recent(roomId) {
      return (byRoom.get(roomId) ?? []).slice();
    },
    async markRead(userId, roomId, at) {
      const prev = reads.get(readKey(userId, roomId));
      if (!prev || at > prev) reads.set(readKey(userId, roomId), at);
    },
    async lastRead(userId, roomId) {
      return reads.get(readKey(userId, roomId));
    },
    async unreadFor(userId, roomIds) {
      return roomIds.map((roomId) => toRoomUnread(roomId, byRoom.get(roomId) ?? [], userId, reads.get(readKey(userId, roomId))));
    },
  };
}
