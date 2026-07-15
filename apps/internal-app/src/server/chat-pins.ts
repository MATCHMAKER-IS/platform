/**
 * ピン留め(ルーム共有)とブックマーク(個人)の保存。@platform/chat の純ロジックに委譲。
 * 既定インメモリ、本番は Prisma 等に差し替え可能。
 * @packageDocumentation
 */
import { togglePin, isPinned, pinsOf, toggleBookmark, isBookmarked, bookmarksOf, type Pin, type Bookmark } from "@platform/chat";

/** ピン/ブックマークストア(非同期)。 */
export interface PinStore {
  /** ピンをトグルし、ピン状態(true=固定した)を返す。 */
  togglePin(roomId: string, messageId: string, byUserId: string, at?: string): Promise<boolean>;
  /** ルームのピン留め(新しい順)。 */
  pins(roomId: string): Promise<Pin[]>;
  /** ブックマークをトグルし、状態(true=保存した)を返す。 */
  toggleBookmark(userId: string, messageId: string, roomId: string, at?: string): Promise<boolean>;
  /** ユーザーのブックマーク(新しい順)。 */
  bookmarks(userId: string): Promise<Bookmark[]>;
}

/** インメモリ実装。 */
export function createMemoryPinStore(): PinStore {
  let pins: Pin[] = [];
  let bookmarks: Bookmark[] = [];
  return {
    async togglePin(roomId, messageId, byUserId, at) {
      const before = isPinned(pins, roomId, messageId);
      pins = togglePin(pins, { roomId, messageId, pinnedBy: byUserId, pinnedAt: at ?? new Date().toISOString() });
      return !before; // トグル後にピンされたか
    },
    async pins(roomId) {
      return pinsOf(pins, roomId);
    },
    async toggleBookmark(userId, messageId, roomId, at) {
      const before = isBookmarked(bookmarks, userId, messageId);
      bookmarks = toggleBookmark(bookmarks, { userId, messageId, roomId, at: at ?? new Date().toISOString() });
      return !before;
    },
    async bookmarks(userId) {
      return bookmarksOf(bookmarks, userId);
    },
  };
}

/** PinRow / BookmarkRow(Prisma 生成型の必要部分)。 */
export interface PinRow {
  roomId: string;
  messageId: string;
  pinnedBy: string;
  pinnedAt: Date;
}
export interface BookmarkRow {
  userId: string;
  messageId: string;
  roomId: string;
  at: Date;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface PinStoreDb {
  pinRow: {
    findUnique(args: { where: { roomId_messageId: { roomId: string; messageId: string } } }): Promise<PinRow | null>;
    create(args: { data: { roomId: string; messageId: string; pinnedBy: string; pinnedAt: Date } }): Promise<unknown>;
    delete(args: { where: { roomId_messageId: { roomId: string; messageId: string } } }): Promise<unknown>;
    findMany(args: { where: { roomId: string }; orderBy: { pinnedAt: "desc" } }): Promise<PinRow[]>;
  };
  bookmarkRow: {
    findUnique(args: { where: { userId_messageId: { userId: string; messageId: string } } }): Promise<BookmarkRow | null>;
    create(args: { data: { userId: string; messageId: string; roomId: string; at: Date } }): Promise<unknown>;
    delete(args: { where: { userId_messageId: { userId: string; messageId: string } } }): Promise<unknown>;
    findMany(args: { where: { userId: string }; orderBy: { at: "desc" } }): Promise<BookmarkRow[]>;
  };
}

/** Prisma 実装。 */
export function createPrismaPinStore(db: PinStoreDb): PinStore {
  return {
    async togglePin(roomId, messageId, byUserId, at) {
      const existing = await db.pinRow.findUnique({ where: { roomId_messageId: { roomId, messageId } } });
      if (existing) {
        await db.pinRow.delete({ where: { roomId_messageId: { roomId, messageId } } });
        return false;
      }
      await db.pinRow.create({ data: { roomId, messageId, pinnedBy: byUserId, pinnedAt: at ? new Date(at) : new Date() } });
      return true;
    },
    async pins(roomId) {
      const rows = await db.pinRow.findMany({ where: { roomId }, orderBy: { pinnedAt: "desc" } });
      return rows.map((r) => ({ roomId: r.roomId, messageId: r.messageId, pinnedBy: r.pinnedBy, pinnedAt: r.pinnedAt.toISOString() }));
    },
    async toggleBookmark(userId, messageId, roomId, at) {
      const existing = await db.bookmarkRow.findUnique({ where: { userId_messageId: { userId, messageId } } });
      if (existing) {
        await db.bookmarkRow.delete({ where: { userId_messageId: { userId, messageId } } });
        return false;
      }
      await db.bookmarkRow.create({ data: { userId, messageId, roomId, at: at ? new Date(at) : new Date() } });
      return true;
    },
    async bookmarks(userId) {
      const rows = await db.bookmarkRow.findMany({ where: { userId }, orderBy: { at: "desc" } });
      return rows.map((r) => ({ userId: r.userId, messageId: r.messageId, roomId: r.roomId, at: r.at.toISOString() }));
    },
  };
}

