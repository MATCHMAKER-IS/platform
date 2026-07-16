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

/**
 * ルームを作成する。
 *
 * @param input 名前・メンバーなど
 * @param now 現在時刻(テスト注入用)
 * @returns 作成したルーム
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 名前が空の場合
 */
export function createRoom(input: { id: string; name: string; kind: RoomKind; memberIds: string[]; createdAt?: string }): ChatRoom {
  return { id: input.id, name: input.name, kind: input.kind, memberIds: [...new Set(input.memberIds)], createdAt: input.createdAt ?? new Date().toISOString() };
}

/**
 * 最新のメッセージを返す(ルーム一覧のプレビュー用)。
 *
 * @param messages メッセージの配列
 * @returns 最新のメッセージ。**空なら undefined**
 */
export function lastMessage(messages: ChatMessage[]): ChatMessage | undefined {
  const sorted = sortMessages(messages);
  return sorted[sorted.length - 1];
}

/**
 * 未読数を数える。
 *
 * **自分の発言は未読に数えない**(自分が書いたものを「未読」と言われても困る)。
 *
 * @param messages メッセージの配列
 * @param member メンバー(userId と lastReadAt を持つ)
 * @returns 未読数
 */
export function unreadCount(messages: ChatMessage[], member: RoomMember): number {
  return messages.filter((m) => m.senderId !== member.userId && (!member.lastReadAt || m.at > member.lastReadAt)).length;
}

/**
 * 既読にする。
 *
 * @param member メンバー
 * @param now 既読の時刻(省略時は現在)
 * @returns 更新した**新しい**メンバー(元は変更しない)
 */
export function markRead(member: RoomMember, at?: string): RoomMember {
  return { ...member, lastReadAt: at ?? new Date().toISOString() };
}

/**
 * 未読の最初のメッセージを返す。
 *
 * 画面に「ここから未読」の区切り線を出すのに使う。
 *
 * @param messages メッセージの配列
 * @param member メンバー
 * @returns 未読の最初のメッセージ。**すべて既読なら undefined**
 */
export function firstUnread(messages: ChatMessage[], member: RoomMember): ChatMessage | undefined {
  return sortMessages(messages).find((m) => m.senderId !== member.userId && (!member.lastReadAt || m.at > member.lastReadAt));
}

/**
 * ルーム一覧を最新メッセージ順に並べる。
 *
 * **動きのあるルームを上に**出す(名前順だと、活発なルームが埋もれる)。
 *
 * @param rooms ルームの配列
 * @param messages 全メッセージ(roomId で紐づける)
 * @returns 最新メッセージの新しい順。**メッセージが無いルームは最後**
 */
export function sortRoomsByActivity(rooms: ChatRoom[], messagesByRoom: Record<string, ChatMessage[]>): ChatRoom[] {
  const lastAt = (room: ChatRoom): string => lastMessage(messagesByRoom[room.id] ?? [])?.at ?? room.createdAt;
  return rooms.slice().sort((a, b) => (lastAt(a) > lastAt(b) ? -1 : lastAt(a) < lastAt(b) ? 1 : 0));
}
