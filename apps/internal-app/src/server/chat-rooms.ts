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
