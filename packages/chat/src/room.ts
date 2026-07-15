/**
 * チャットルームとメンバー(純ロジック)。未読数・最終既読・最新メッセージ。
 * @packageDocumentation
 */
import { type ChatMessage, sortMessages } from "./message.js";

/** ルーム種別。 */
export type RoomKind = "dm" | "group";

/** チャットルーム。 */
export interface ChatRoom {
  id: string;
  name: string;
  kind: RoomKind;
  memberIds: string[];
  createdAt: string;
}

/** ルームメンバーの既読状態。 */
export interface RoomMember {
  userId: string;
  /** 最後に既読にした日時(ISO)。未設定なら全未読。 */
  lastReadAt?: string;
}

/** ルームを作成する。 */
export function createRoom(input: { id: string; name: string; kind: RoomKind; memberIds: string[]; createdAt?: string }): ChatRoom {
  return { id: input.id, name: input.name, kind: input.kind, memberIds: [...new Set(input.memberIds)], createdAt: input.createdAt ?? new Date().toISOString() };
}

/** 最新メッセージを返す。 */
export function lastMessage(messages: ChatMessage[]): ChatMessage | undefined {
  const sorted = sortMessages(messages);
  return sorted[sorted.length - 1];
}

/** メンバーの未読数(最終既読より後・かつ自分以外の送信)を数える。 */
export function unreadCount(messages: ChatMessage[], member: RoomMember): number {
  return messages.filter((m) => m.senderId !== member.userId && (!member.lastReadAt || m.at > member.lastReadAt)).length;
}

/** 既読にする(lastReadAt を更新)。省略時は現在時刻。 */
export function markRead(member: RoomMember, at?: string): RoomMember {
  return { ...member, lastReadAt: at ?? new Date().toISOString() };
}

/** 未読の最初のメッセージ(既読位置の区切り表示用)。 */
export function firstUnread(messages: ChatMessage[], member: RoomMember): ChatMessage | undefined {
  return sortMessages(messages).find((m) => m.senderId !== member.userId && (!member.lastReadAt || m.at > member.lastReadAt));
}

/** ルーム一覧を最新メッセージ順に並べる(メッセージは roomId で紐づく)。 */
export function sortRoomsByActivity(rooms: ChatRoom[], messagesByRoom: Record<string, ChatMessage[]>): ChatRoom[] {
  const lastAt = (room: ChatRoom): string => lastMessage(messagesByRoom[room.id] ?? [])?.at ?? room.createdAt;
  return rooms.slice().sort((a, b) => (lastAt(a) > lastAt(b) ? -1 : lastAt(a) < lastAt(b) ? 1 : 0));
}
