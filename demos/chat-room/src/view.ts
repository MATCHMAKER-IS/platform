/**
 * chat のメッセージを UI(MessageList / ChatWindow)が使う MessageGroup[] 形へ整形する。
 * @packageDocumentation
 */
import { groupByDate, type ChatMessage } from "@platform/chat";

/** UI 表示用メッセージ。 */
export interface DisplayMessage {
  id: string;
  text: string;
  authorName?: string;
  timestamp?: string;
  own?: boolean;
  edited?: boolean;
}

/** 日付グループ。 */
export interface MessageGroup {
  date: string;
  messages: DisplayMessage[];
}

/** 時刻 "HH:MM"(UTC 表記の簡易版)。 */
function hhmm(iso: string): string {
  return iso.slice(11, 16);
}

/** メッセージ配列を、自分視点・表示名解決つきで UI 用グループに変換する。 */
export function toMessageGroups(messages: ChatMessage[], meId: string, nameOf: (userId: string) => string): MessageGroup[] {
  return groupByDate(messages).map((g) => ({
    date: g.date,
    messages: g.messages.map((m) => ({
      id: m.id,
      text: m.text,
      authorName: nameOf(m.senderId),
      timestamp: hhmm(m.at),
      own: m.senderId === meId,
      edited: Boolean(m.editedAt),
    })),
  }));
}
