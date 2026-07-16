/**
 * ChatStore の Prisma 実装。未読ロジックは @platform/chat に委譲し、DB からは履歴と既読を取り出すだけ。
 * `db` は Prisma クライアント(または同形のポート)。schema.prisma の ChatMessageRow / MessageReadRow を使う。
 * @packageDocumentation
 */
import { type ChatMessage, type Attachment } from "@platform/chat";
import { type ChatStore, type RoomUnread, toRoomUnread } from "./chat-store";

/** ChatMessageRow(Prisma 生成型の必要部分)。 */
export interface ChatMessageRow {
  id: string;
  roomId: string;
  senderId: string;
  text: string;
  at: Date;
  replyTo: string | null;
  editedAt: Date | null;
  attachments: unknown;
}

/** MessageReadRow の必要部分。 */
export interface MessageReadRow {
  userId: string;
  roomId: string;
  lastReadAt: Date;
}

/** 使用する Prisma デリゲートの最小ポート(テストで差し替え可能)。 */
export interface ChatStoreDb {
  chatMessageRow: {
    create(args: { data: { id: string; roomId: string; senderId: string; text: string; at: Date; replyTo: string | null; editedAt: Date | null; attachments: unknown } }): Promise<unknown>;
    findMany(args: { where: { roomId: string }; orderBy: { at: "asc" | "desc" }; take?: number }): Promise<ChatMessageRow[]>;
    update(args: { where: { id: string }; data: { text: string; editedAt: Date } }): Promise<unknown>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
  messageReadRow: {
    findUnique(args: { where: { userId_roomId: { userId: string; roomId: string } } }): Promise<MessageReadRow | null>;
    upsert(args: { where: { userId_roomId: { userId: string; roomId: string } }; create: { userId: string; roomId: string; lastReadAt: Date }; update: { lastReadAt: Date } }): Promise<unknown>;
  };
}

/** 行 → ドメインのメッセージへ。 */
function rowToMessage(row: ChatMessageRow): ChatMessage {
  const msg: ChatMessage = { id: row.id, roomId: row.roomId, senderId: row.senderId, text: row.text, at: row.at.toISOString() };
  if (row.replyTo) msg.replyTo = row.replyTo;
  if (row.editedAt) msg.editedAt = row.editedAt.toISOString();
  const atts = Array.isArray(row.attachments) ? (row.attachments as Attachment[]) : [];
  if (atts.length > 0) msg.attachments = atts;
  return msg;
}

/** Prisma 実装を作る。 */
export function createPrismaChatStore(db: ChatStoreDb, options: { keepPerRoom?: number } = {}): ChatStore {
  const keep = options.keepPerRoom ?? 500;
  return {
    async append(message) {
      await db.chatMessageRow.create({
        data: {
          id: message.id,
          roomId: message.roomId,
          senderId: message.senderId,
          text: message.text,
          at: new Date(message.at),
          replyTo: message.replyTo ?? null,
          editedAt: message.editedAt ? new Date(message.editedAt) : null,
          attachments: message.attachments ?? [],
        },
      });
    },
    async recent(roomId) {
      // 直近 keep 件を新しい順で取り、古い→新しいに反転
      const rows = await db.chatMessageRow.findMany({ where: { roomId }, orderBy: { at: "desc" }, take: keep });
      return rows.map(rowToMessage).reverse();
    },
    async update(message) {
      await db.chatMessageRow.update({ where: { id: message.id }, data: { text: message.text, editedAt: message.editedAt ? new Date(message.editedAt) : new Date() } });
    },
    async remove(_roomId, messageId) {
      await db.chatMessageRow.delete({ where: { id: messageId } });
    },
    async markRead(userId, roomId, at) {
      const existing = await db.messageReadRow.findUnique({ where: { userId_roomId: { userId, roomId } } });
      // 後退しない: 既存が新しければ何もしない
      if (existing && existing.lastReadAt.toISOString() >= at) return;
      const when = new Date(at);
      await db.messageReadRow.upsert({
        where: { userId_roomId: { userId, roomId } },
        create: { userId, roomId, lastReadAt: when },
        update: { lastReadAt: when },
      });
    },
    async lastRead(userId, roomId) {
      const row = await db.messageReadRow.findUnique({ where: { userId_roomId: { userId, roomId } } });
      return row ? row.lastReadAt.toISOString() : undefined;
    },
    async unreadFor(userId, roomIds): Promise<RoomUnread[]> {
      return Promise.all(
        roomIds.map(async (roomId) => {
          const [msgs, lr] = await Promise.all([this.recent(roomId), this.lastRead(userId, roomId)]);
          return toRoomUnread(roomId, msgs, userId, lr);
        }),
      );
    },
  };
}
