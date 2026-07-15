/**
 * 記事の変更履歴（リビジョン）。保存のたびにスナップショットを積み、前の版に戻せる。
 * @packageDocumentation
 */
import { type CmsPost, type CmsPostInput } from "./model.js";

/** 記事の 1 版。 */
export interface Revision {
  id: string;
  postSlug: string;
  version: number;
  title: string;
  body: string;
  categoryId?: string;
  excerpt?: string;
  eyecatch?: string;
  tags: string[];
  status: string;
  publishedAt?: string;
  savedBy: string;
  savedAt: string;
}

/** CmsPost からリビジョンのスナップショット部分を作る。 */
export function snapshotOf(post: CmsPost): Omit<Revision, "id" | "postSlug" | "version" | "savedBy" | "savedAt"> {
  const snap: Omit<Revision, "id" | "postSlug" | "version" | "savedBy" | "savedAt"> = { title: post.title, body: post.body, tags: post.tags, status: post.status };
  if (post.categoryId !== undefined) snap.categoryId = post.categoryId;
  if (post.excerpt !== undefined) snap.excerpt = post.excerpt;
  if (post.eyecatch !== undefined) snap.eyecatch = post.eyecatch;
  if (post.publishedAt !== undefined) snap.publishedAt = post.publishedAt;
  return snap;
}

/** リビジョンを復元用の入力（CmsPostInput）に変換する（下書きとして戻す）。 */
export function revisionToInput(rev: Revision, slug: string): CmsPostInput {
  const input: CmsPostInput = { slug, title: rev.title, body: rev.body, tags: rev.tags, status: "draft" };
  if (rev.categoryId !== undefined) input.categoryId = rev.categoryId;
  if (rev.excerpt !== undefined) input.excerpt = rev.excerpt;
  if (rev.eyecatch !== undefined) input.eyecatch = rev.eyecatch;
  return input;
}

/** リビジョンストア。 */
export interface RevisionStore {
  list(postSlug: string): Promise<Revision[]>;
  get(id: string): Promise<Revision | undefined>;
  /** 現在の記事状態を新しい版として記録する。 */
  record(post: CmsPost, savedBy: string): Promise<Revision>;
}

/** インメモリ実装。 */
export function createMemoryRevisionStore(genId: () => string = () => `rev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, now: () => string = () => new Date().toISOString()): RevisionStore {
  const byId = new Map<string, Revision>();
  const bySlug = new Map<string, Revision[]>();
  return {
    async list(postSlug) {
      return (bySlug.get(postSlug) ?? []).slice().sort((a, b) => b.version - a.version);
    },
    async get(id) {
      return byId.get(id);
    },
    async record(post, savedBy) {
      const existing = bySlug.get(post.slug) ?? [];
      const version = existing.reduce((max, r) => Math.max(max, r.version), 0) + 1;
      const rev: Revision = { id: genId(), postSlug: post.slug, version, savedBy, savedAt: now(), ...snapshotOf(post) };
      existing.push(rev);
      bySlug.set(post.slug, existing);
      byId.set(rev.id, rev);
      return rev;
    },
  };
}

// ── Prisma 実装 ──

/** CmsRevisionRow の必要部分。 */
export interface CmsRevisionRow {
  id: string;
  postSlug: string;
  version: number;
  title: string;
  body: string;
  categoryId: string | null;
  excerpt: string | null;
  eyecatch: string | null;
  tags: unknown;
  status: string;
  publishedAt: Date | null;
  savedBy: string;
  savedAt: Date;
}

interface CmsRevisionRowData {
  postSlug: string;
  version: number;
  title: string;
  body: string;
  categoryId: string | null;
  excerpt: string | null;
  eyecatch: string | null;
  tags: string[];
  status: string;
  publishedAt: Date | null;
  savedBy: string;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface RevisionStoreDb {
  cmsRevisionRow: {
    findMany(args: { where: { postSlug: string }; orderBy: { version: "desc" } }): Promise<CmsRevisionRow[]>;
    findUnique(args: { where: { id: string } }): Promise<CmsRevisionRow | null>;
    aggregate(args: { where: { postSlug: string }; _max: { version: true } }): Promise<{ _max: { version: number | null } }>;
    create(args: { data: CmsRevisionRowData }): Promise<CmsRevisionRow>;
  };
}

function rowToRevision(row: CmsRevisionRow): Revision {
  const rev: Revision = { id: row.id, postSlug: row.postSlug, version: row.version, title: row.title, body: row.body, tags: Array.isArray(row.tags) ? (row.tags as string[]) : [], status: row.status, savedBy: row.savedBy, savedAt: row.savedAt.toISOString() };
  if (row.categoryId) rev.categoryId = row.categoryId;
  if (row.excerpt) rev.excerpt = row.excerpt;
  if (row.eyecatch) rev.eyecatch = row.eyecatch;
  if (row.publishedAt) rev.publishedAt = row.publishedAt.toISOString();
  return rev;
}

/** Prisma 実装。 */
export function createPrismaRevisionStore(db: RevisionStoreDb): RevisionStore {
  return {
    async list(postSlug) {
      return (await db.cmsRevisionRow.findMany({ where: { postSlug }, orderBy: { version: "desc" } })).map(rowToRevision);
    },
    async get(id) {
      const row = await db.cmsRevisionRow.findUnique({ where: { id } });
      return row ? rowToRevision(row) : undefined;
    },
    async record(post, savedBy) {
      const agg = await db.cmsRevisionRow.aggregate({ where: { postSlug: post.slug }, _max: { version: true } });
      const version = (agg._max.version ?? 0) + 1;
      const snap = snapshotOf(post);
      const row = await db.cmsRevisionRow.create({ data: { postSlug: post.slug, version, savedBy, title: snap.title, body: snap.body, categoryId: snap.categoryId ?? null, excerpt: snap.excerpt ?? null, eyecatch: snap.eyecatch ?? null, tags: snap.tags, status: snap.status, publishedAt: snap.publishedAt ? new Date(snap.publishedAt) : null } });
      return rowToRevision(row);
    },
  };
}
