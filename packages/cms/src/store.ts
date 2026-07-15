/**
 * CMS ストア（記事 CRUD）。memory / prisma。
 * @packageDocumentation
 */
import { toPost, type CmsPost, type CmsPostInput, type PostStatus } from "./model.js";

/** CMS ストア。 */
export interface CmsStore {
  list(options?: { status?: PostStatus }): Promise<CmsPost[]>;
  get(slug: string): Promise<CmsPost | undefined>;
  create(input: CmsPostInput): Promise<CmsPost>;
  update(slug: string, input: CmsPostInput): Promise<CmsPost | undefined>;
  remove(slug: string): Promise<boolean>;
}

/** インメモリ実装。 */
export function createMemoryCmsStore(now: () => string = () => new Date().toISOString()): CmsStore {
  const bySlug = new Map<string, CmsPost>();
  const sorted = () => [...bySlug.values()].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return {
    async list(options = {}) {
      const all = sorted();
      return options.status ? all.filter((p) => p.status === options.status) : all;
    },
    async get(slug) {
      return bySlug.get(slug);
    },
    async create(input) {
      const post = toPost(input, now());
      bySlug.set(post.slug, post);
      return post;
    },
    async update(slug, input) {
      if (!bySlug.has(slug)) return undefined;
      const post = toPost(input, now());
      if (slug !== post.slug) bySlug.delete(slug);
      bySlug.set(post.slug, post);
      return post;
    },
    async remove(slug) {
      return bySlug.delete(slug);
    },
  };
}

// ── Prisma 実装 ──

/** CmsPostRow の必要部分。 */
export interface CmsPostRow {
  slug: string;
  title: string;
  categoryId: string | null;
  excerpt: string | null;
  eyecatch: string | null;
  body: string;
  tags: unknown;
  status: string;
  publishedAt: Date | null;
  updatedAt: Date;
}

interface CmsPostRowData {
  slug: string;
  title: string;
  categoryId: string | null;
  excerpt: string | null;
  eyecatch: string | null;
  body: string;
  tags: string[];
  status: string;
  publishedAt: Date | null;
  updatedAt: Date;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface CmsStoreDb {
  cmsPostRow: {
    findMany(args: { where?: { status?: string }; orderBy: { updatedAt: "desc" } }): Promise<CmsPostRow[]>;
    findUnique(args: { where: { slug: string } }): Promise<CmsPostRow | null>;
    create(args: { data: CmsPostRowData }): Promise<CmsPostRow>;
    update(args: { where: { slug: string }; data: CmsPostRowData }): Promise<CmsPostRow>;
    delete(args: { where: { slug: string } }): Promise<unknown>;
  };
}

function rowToPost(row: CmsPostRow): CmsPost {
  const post: CmsPost = { slug: row.slug, title: row.title, body: row.body, tags: Array.isArray(row.tags) ? (row.tags as string[]) : [], status: row.status === "published" ? "published" : "draft", updatedAt: row.updatedAt.toISOString() };
  if (row.categoryId) post.categoryId = row.categoryId;
  if (row.excerpt) post.excerpt = row.excerpt;
  if (row.eyecatch) post.eyecatch = row.eyecatch;
  if (row.publishedAt) post.publishedAt = row.publishedAt.toISOString();
  return post;
}

function toRowData(post: CmsPost): CmsPostRowData {
  return { slug: post.slug, title: post.title, categoryId: post.categoryId ?? null, excerpt: post.excerpt ?? null, eyecatch: post.eyecatch ?? null, body: post.body, tags: post.tags, status: post.status, publishedAt: post.publishedAt ? new Date(post.publishedAt) : null, updatedAt: new Date(post.updatedAt) };
}

/** Prisma 実装。 */
export function createPrismaCmsStore(db: CmsStoreDb, now: () => string = () => new Date().toISOString()): CmsStore {
  return {
    async list(options = {}) {
      const rows = await db.cmsPostRow.findMany({ ...(options.status ? { where: { status: options.status } } : {}), orderBy: { updatedAt: "desc" } });
      return rows.map(rowToPost);
    },
    async get(slug) {
      const row = await db.cmsPostRow.findUnique({ where: { slug } });
      return row ? rowToPost(row) : undefined;
    },
    async create(input) {
      const post = toPost(input, now());
      const row = await db.cmsPostRow.create({ data: toRowData(post) });
      return rowToPost(row);
    },
    async update(slug, input) {
      const existing = await db.cmsPostRow.findUnique({ where: { slug } });
      if (!existing) return undefined;
      const post = toPost(input, now());
      const row = await db.cmsPostRow.update({ where: { slug }, data: toRowData(post) });
      return rowToPost(row);
    },
    async remove(slug) {
      const existing = await db.cmsPostRow.findUnique({ where: { slug } });
      if (!existing) return false;
      await db.cmsPostRow.delete({ where: { slug } });
      return true;
    },
  };
}
