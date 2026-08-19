/**
 * ルーム・メンバーのリポジトリ。所属からルーム一覧を解決する。
 * 開発は `createMemoryRoomRepo`、本番は `createPrismaRoomRepo`。@platform/chat の型を使う。
 * @packageDocumentation
 */
import { createRoom, type ChatRoom, type RoomKind } from "@platform/chat";

/** ルーム作成の入力。 */
export interface CreateRoomInput {
  id?: string;
  name: string;
  kind: RoomKind;
  /** 作成者(owner として追加)。 */
  ownerId: string;
  /** 初期メンバー(owner 含む・重複除去)。 */
  memberIds?: string[];
}

/** ルーム・メンバーのリポジトリ(非同期)。 */
export interface RoomRepository {
  /** ルームを作成し、owner と初期メンバーを登録する。 */
  create(input: CreateRoomInput): Promise<ChatRoom>;
  /** メンバーを追加する(既に居れば無視)。 */
  addMember(roomId: string, userId: string): Promise<void>;
  /** メンバーを外す。 */
  removeMember(roomId: string, userId: string): Promise<void>;
  /** ユーザーが所属するルーム ID 一覧。 */
  roomIdsForUser(userId: string): Promise<string[]>;
  /** ユーザーが所属するルーム一覧。 */
  roomsForUser(userId: string): Promise<ChatRoom[]>;
  /** ルームを取得する。 */
  get(roomId: string): Promise<ChatRoom | undefined>;
  /** 所属確認。 */
  isMember(roomId: string, userId: string): Promise<boolean>;
}

/** インメモリ実装(開発用)。 */
export function createMemoryRoomRepo(options: { newId?: () => string } = {}): RoomRepository {
  const newId = options.newId ?? (() => `room_${Math.random().toString(36).slice(2)}`);
  const rooms = new Map<string, ChatRoom>();
  const members = new Map<string, Set<string>>(); // roomId -> userIds

  return {
    async create(input) {
      const id = input.id ?? newId();
      const memberIds = [...new Set([input.ownerId, ...(input.memberIds ?? [])])];
      const room = createRoom({ id, name: input.name, kind: input.kind, memberIds });
      rooms.set(id, room);
      members.set(id, new Set(memberIds));
      return room;
    },
    async addMember(roomId, userId) {
      const set = members.get(roomId);
      if (set) set.add(userId);
    },
    async removeMember(roomId, userId) {
      members.get(roomId)?.delete(userId);
    },
    async roomIdsForUser(userId) {
      const ids: string[] = [];
      for (const [roomId, set] of members) if (set.has(userId)) ids.push(roomId);
      return ids;
    },
    async roomsForUser(userId) {
      const ids: string[] = [];
      for (const [roomId, set] of members) if (set.has(userId)) ids.push(roomId);
      return ids.map((id) => rooms.get(id)).filter((r): r is ChatRoom => r !== undefined);
    },
    async get(roomId) {
      return rooms.get(roomId);
    },
    async isMember(roomId, userId) {
      return members.get(roomId)?.has(userId) ?? false;
    },
  };
}

/** Prisma のうち、この層が使う部分だけ。 */
export interface RoomRepoDb {
  chatRoomRow: {
    create(args: unknown): Promise<{ id: string; name: string; kind: string; createdAt: Date }>;
    findUnique(args: unknown): Promise<{ id: string; name: string; kind: string; createdAt: Date } | null>;
    findMany(args: unknown): Promise<{ id: string; name: string; kind: string; createdAt: Date }[]>;
  };
  roomMemberRow: {
    createMany(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<{ roomId: string; userId: string }[]>;
    deleteMany(args: unknown): Promise<unknown>;
    findFirst(args: unknown): Promise<{ roomId: string } | null>;
  };
}

/**
 * Prisma 実装(本番用)。
 *
 * **メモリ実装のままだと再起動でルームが消える。**
 * 作った翌日に「昨日のルームが無い」となるので、
 * 業務で使うなら保存が要る(2026-08 に気づいた)。
 *
 * @param db Prisma クライアント
 * @returns リポジトリ
 */
export function createPrismaRoomRepo(db: RoomRepoDb): RoomRepository {
  /** 行と参加者から ChatRoom を組み立てる。 */
  const toRoom = (
    r: { id: string; name: string; kind: string; createdAt: Date },
    memberIds: string[],
  ): ChatRoom => ({
    id: r.id, name: r.name, kind: r.kind as RoomKind,
    memberIds, createdAt: r.createdAt.toISOString(),
  });

  return {
    async create(input) {
      // **作成者は必ず参加者に入れる。** 自分が入れないルームを作れてしまう
      const members = [...new Set([input.ownerId, ...(input.memberIds ?? [])])];
      // **ルームと参加者を 1 回で作る。**
      // 2 回に分けると、参加者の登録で失敗したとき
      // **誰も入っていないルームが残る**(作った本人すら入れない)。
      // 入れ子で書けば Prisma が 1 つのトランザクションにまとめる
      const row = await db.chatRoomRow.create({
        data: {
          ...(input.id !== undefined ? { id: input.id } : {}),
          name: input.name,
          kind: input.kind,
          members: {
            create: members.map((userId) => ({
              userId,
              role: userId === input.ownerId ? "owner" : "member",
            })),
          },
        },
      });
      return toRoom(row, members);
    },

    async addMember(roomId, userId) {
      // **既に居れば何もしない。** 二重に押しても増えない
      const found = await db.roomMemberRow.findFirst({ where: { roomId, userId } });
      if (found !== null) return;
      await db.roomMemberRow.createMany({ data: [{ roomId, userId, role: "member" }] });
    },

    async removeMember(roomId, userId) {
      await db.roomMemberRow.deleteMany({ where: { roomId, userId } });
    },

    async roomIdsForUser(userId) {
      const rows = await db.roomMemberRow.findMany({ where: { userId } });
      return rows.map((r) => r.roomId);
    },

    async roomsForUser(userId) {
      const ids = await this.roomIdsForUser(userId);
      if (ids.length === 0) return [];
      const rows = await db.chatRoomRow.findMany({
        where: { id: { in: ids } },
        orderBy: { createdAt: "desc" },
      });
      const members = await db.roomMemberRow.findMany({ where: { roomId: { in: ids } } });
      return rows.map((r) => toRoom(r, members.filter((m) => m.roomId === r.id).map((m) => m.userId)));
    },

    async get(roomId) {
      const row = await db.chatRoomRow.findUnique({ where: { id: roomId } });
      if (row === null) return undefined;
      const members = await db.roomMemberRow.findMany({ where: { roomId } });
      return toRoom(row, members.map((m) => m.userId));
    },

    async isMember(roomId, userId) {
      return (await db.roomMemberRow.findFirst({ where: { roomId, userId } })) !== null;
    },
  };
}
