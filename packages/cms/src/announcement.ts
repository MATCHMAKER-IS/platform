/**
 * お知らせ（サイト上部のバナー告知）の管理。表示期間・対象パス・CTA。
 * Announcement 型と表示判定（activeAnnouncements）は @platform/site 側。
 * @packageDocumentation
 */
import { type Announcement } from "@platform/site";

/** お知らせの入力。 */
/**
 * お知らせの重要度。**`@platform/site` の `Announcement["level"]` と同じ**。
 * ずれると「CMS で保存できるのにサイトで型エラー」になる。
 */
export type AnnouncementLevel = NonNullable<Announcement["level"]>;

/**
 * 重要度として妥当かを判定する型ガード。
 *
 * **DB からは `string`(や `unknown`)で来る**ため、`AnnouncementLevel` に
 * 絞り込む前段のバリデーションに使う。想定外の値はそのまま弾ける。
 *
 * @param v 判定対象の値(DB 由来の未検証値を想定)
 * @returns `"info"` / `"warning"` / `"sale"` のいずれかなら `true`(型ガード)
 *
 * @example
 * ```ts
 * if (isAnnouncementLevel(row.level)) a.level = row.level; // ここで level は AnnouncementLevel に絞り込まれる
 * ```
 */
export function isAnnouncementLevel(v: unknown): v is AnnouncementLevel {
  return v === "info" || v === "warning" || v === "sale";
}

export interface AnnouncementInput {
  message: string;
  startAt?: string;
  endAt?: string;
  paths?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  /** 重要度。**@platform/site の Announcement.level と同じ union** に揃える。 */
  level?: AnnouncementLevel;
}

/**
 * お知らせの入力を検証する。
 *
 * @param input 入力
 * @returns 問題の一覧(空なら妥当)
 */
export function validateAnnouncementInput(input: AnnouncementInput): { ok: true; value: AnnouncementInput } | { ok: false; error: string } {
  if (!input.message.trim()) return { ok: false, error: "メッセージは必須です" };
  if (input.startAt !== undefined && isNaN(new Date(input.startAt).getTime())) return { ok: false, error: "開始日時が不正です" };
  if (input.endAt !== undefined && isNaN(new Date(input.endAt).getTime())) return { ok: false, error: "終了日時が不正です" };
  return { ok: true, value: input };
}

function toAnnouncement(id: string, input: AnnouncementInput): Announcement {
  const a: Announcement = { id, message: input.message };
  if (input.startAt !== undefined) a.startAt = input.startAt;
  if (input.endAt !== undefined) a.endAt = input.endAt;
  if (input.paths !== undefined) a.paths = input.paths;
  if (input.ctaLabel !== undefined) a.ctaLabel = input.ctaLabel;
  if (input.ctaHref !== undefined) a.ctaHref = input.ctaHref;
  if (input.level !== undefined) a.level = input.level;
  return a;
}

/** お知らせストア。 */
export interface AnnouncementStore {
  list(): Promise<Announcement[]>;
  get(id: string): Promise<Announcement | undefined>;
  create(input: AnnouncementInput): Promise<Announcement>;
  update(id: string, input: AnnouncementInput): Promise<Announcement | undefined>;
  remove(id: string): Promise<boolean>;
}

/**
 * お知らせストアのメモリ実装(開発・テスト用)。
 *
 * @param seed 初期データ
 * @returns お知らせストア(再起動で消える)
 */
export function createMemoryAnnouncementStore(genId: () => string = () => `ann_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`): AnnouncementStore {
  const byId = new Map<string, Announcement>();
  const order: string[] = [];
  return {
    async list() {
      return order.map((id) => byId.get(id)!).filter(Boolean);
    },
    async get(id) {
      return byId.get(id);
    },
    async create(input) {
      const id = genId();
      const a = toAnnouncement(id, input);
      byId.set(id, a);
      order.push(id);
      return a;
    },
    async update(id, input) {
      if (!byId.has(id)) return undefined;
      const a = toAnnouncement(id, input);
      byId.set(id, a);
      return a;
    },
    async remove(id) {
      const i = order.indexOf(id);
      if (i >= 0) order.splice(i, 1);
      return byId.delete(id);
    },
  };
}

// ── Prisma 実装 ──

/** AnnouncementRow の必要部分。 */
export interface AnnouncementRow {
  id: string;
  message: string;
  startAt: Date | null;
  endAt: Date | null;
  paths: unknown;
  ctaLabel: string | null;
  ctaHref: string | null;
  level: string | null;
  createdAt: Date;
}

interface AnnouncementRowData {
  message: string;
  startAt: Date | null;
  endAt: Date | null;
  paths: string[];
  ctaLabel: string | null;
  ctaHref: string | null;
  level: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface AnnouncementStoreDb {
  announcementRow: {
    findMany(args: { orderBy: { createdAt: "asc" } }): Promise<AnnouncementRow[]>;
    findUnique(args: { where: { id: string } }): Promise<AnnouncementRow | null>;
    create(args: { data: AnnouncementRowData }): Promise<AnnouncementRow>;
    update(args: { where: { id: string }; data: AnnouncementRowData }): Promise<AnnouncementRow>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
}

function rowToAnnouncement(row: AnnouncementRow): Announcement {
  const a: Announcement = { id: row.id, message: row.message };
  if (row.startAt) a.startAt = row.startAt.toISOString();
  if (row.endAt) a.endAt = row.endAt.toISOString();
  if (Array.isArray(row.paths) && row.paths.length > 0) a.paths = row.paths as string[];
  if (row.ctaLabel) a.ctaLabel = row.ctaLabel;
  if (row.ctaHref) a.ctaHref = row.ctaHref;
  // DB は string。**妥当な値だけ通す**(想定外の値が入っていても画面を壊さない)
  if (isAnnouncementLevel(row.level)) a.level = row.level;
  return a;
}

function toAnnouncementRowData(input: AnnouncementInput): AnnouncementRowData {
  return { message: input.message, startAt: input.startAt ? new Date(input.startAt) : null, endAt: input.endAt ? new Date(input.endAt) : null, paths: input.paths ?? [], ctaLabel: input.ctaLabel ?? null, ctaHref: input.ctaHref ?? null, level: input.level ?? null };
}

/**
 * お知らせストアの Prisma 実装(本番用)。
 *
 * @param db Prisma クライアント
 * @returns お知らせストア
 */
export function createPrismaAnnouncementStore(db: AnnouncementStoreDb): AnnouncementStore {
  return {
    async list() {
      return (await db.announcementRow.findMany({ orderBy: { createdAt: "asc" } })).map(rowToAnnouncement);
    },
    async get(id) {
      const row = await db.announcementRow.findUnique({ where: { id } });
      return row ? rowToAnnouncement(row) : undefined;
    },
    async create(input) {
      const row = await db.announcementRow.create({ data: toAnnouncementRowData(input) });
      return rowToAnnouncement(row);
    },
    async update(id, input) {
      const existing = await db.announcementRow.findUnique({ where: { id } });
      if (!existing) return undefined;
      const row = await db.announcementRow.update({ where: { id }, data: toAnnouncementRowData(input) });
      return rowToAnnouncement(row);
    },
    async remove(id) {
      const existing = await db.announcementRow.findUnique({ where: { id } });
      if (!existing) return false;
      await db.announcementRow.delete({ where: { id } });
      return true;
    },
  };
}
