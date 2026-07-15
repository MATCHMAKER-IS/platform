/**
 * メッセージのリアクション保存。@platform/chat の純ロジックに委譲する。
 * 既定はインメモリ、本番は Prisma 等に差し替え可能。
 * @packageDocumentation
 */
import { toggleReaction, countReactions, userReactions, type MessageReaction } from "@platform/chat";

/** リアクションストア(非同期)。 */
export interface ReactionStore {
  /** トグルして、そのメッセージの最新カウントを返す。 */
  toggle(messageId: string, userId: string, kind: string): Promise<Record<string, number>>;
  /** メッセージの種別ごとカウント。 */
  counts(messageId: string): Promise<Record<string, number>>;
  /** あるユーザーが押した種別。 */
  reactionsBy(messageId: string, userId: string): Promise<string[]>;
}

/** インメモリ実装。 */
export function createMemoryReactionStore(): ReactionStore {
  let reactions: MessageReaction[] = [];
  return {
    async toggle(messageId, userId, kind) {
      reactions = toggleReaction(reactions, { messageId, userId, kind });
      return countReactions(reactions, messageId);
    },
    async counts(messageId) {
      return countReactions(reactions, messageId);
    },
    async reactionsBy(messageId, userId) {
      return userReactions(reactions, messageId, userId);
    },
  };
}

/** MessageReactionRow(Prisma 生成型の必要部分)。 */
export interface MessageReactionRow {
  messageId: string;
  userId: string;
  kind: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ReactionStoreDb {
  messageReactionRow: {
    findUnique(args: { where: { messageId_userId_kind: { messageId: string; userId: string; kind: string } } }): Promise<MessageReactionRow | null>;
    create(args: { data: { messageId: string; userId: string; kind: string } }): Promise<unknown>;
    delete(args: { where: { messageId_userId_kind: { messageId: string; userId: string; kind: string } } }): Promise<unknown>;
    findMany(args: { where: { messageId: string; userId?: string } }): Promise<MessageReactionRow[]>;
  };
}

/** Prisma 実装。集計は @platform/chat の countReactions に委譲。 */
export function createPrismaReactionStore(db: ReactionStoreDb): ReactionStore {
  const rowsToCounts = (rows: MessageReactionRow[], messageId: string) =>
    countReactions(rows.map((r) => ({ messageId: r.messageId, userId: r.userId, kind: r.kind })), messageId);
  return {
    async toggle(messageId, userId, kind) {
      const existing = await db.messageReactionRow.findUnique({ where: { messageId_userId_kind: { messageId, userId, kind } } });
      if (existing) await db.messageReactionRow.delete({ where: { messageId_userId_kind: { messageId, userId, kind } } });
      else await db.messageReactionRow.create({ data: { messageId, userId, kind } });
      const rows = await db.messageReactionRow.findMany({ where: { messageId } });
      return rowsToCounts(rows, messageId);
    },
    async counts(messageId) {
      const rows = await db.messageReactionRow.findMany({ where: { messageId } });
      return rowsToCounts(rows, messageId);
    },
    async reactionsBy(messageId, userId) {
      const rows = await db.messageReactionRow.findMany({ where: { messageId, userId } });
      return rows.map((r) => r.kind);
    },
  };
}

