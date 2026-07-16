/**
 * 固定ページ（会社概要など）の管理。ブロック配列を持ち、下書き/公開を切り替える。
 * Page/PageBlock は @platform/site の型を再利用。
 * @packageDocumentation
 */
import { type Page, type PageBlock } from "@platform/site";

/** ページの状態。 */
export type PageStatus = "draft" | "published";

/** 管理対象の固定ページ。 */
export interface ManagedPage {
  slug: string;
  title: string;
  blocks: PageBlock[];
  status: PageStatus;
  updatedAt: string;
}

/** ページの入力。 */
export interface PageInput {
  slug: string;
  title: string;
  blocks: PageBlock[];
  status?: PageStatus;
}

/**
 * ページの slug が妥当かを判定する。
 *
 * **空文字はトップページ**として許す(記事の slug とはここが違う)。
 *
 * @param slug 判定する slug
 * @returns 妥当なら true
 */
export function isValidPageSlug(slug: string): boolean {
  return slug === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * ページの入力を検証する。
 *
 * @param input 入力
 * @returns 問題の一覧(空なら妥当)
 */
export function validatePageInput(input: PageInput): { ok: true; value: PageInput } | { ok: false; error: string } {
  if (!isValidPageSlug(input.slug)) return { ok: false, error: "slug は空（トップ）か英小文字・数字・ハイフンで指定してください" };
  if (!input.title.trim()) return { ok: false, error: "タイトルは必須です" };
  return { ok: true, value: input };
}

function toManagedPage(input: PageInput, now: string): ManagedPage {
  return { slug: input.slug, title: input.title, blocks: input.blocks, status: input.status ?? "draft", updatedAt: now };
}

/**
 * 公開中のページだけを返す。
 *
 * @param pages ページの配列
 * @returns 公開中のページ
 */
export function livePages(pages: ManagedPage[]): ManagedPage[] {
  return pages.filter((p) => p.status === "published");
}

/**
 * 管理用のページを、公開サイト用の形に変換する。
 *
 * **`status` を落とす**のは、公開サイトに「これは下書きです」といった内部情報を
 * 渡さないため(渡した先で誤って表示される事故を防ぐ)。
 *
 * @param page 管理用のページ
 * @returns 公開サイト用のページ
 */
export function toPageView(page: ManagedPage): Page {
  return { slug: page.slug, title: page.title, blocks: page.blocks };
}

/**
 * 公開中のページを、公開サイト用の配列にする。
 *
 * @param pages ページの配列(下書きが混ざっていてよい)
 * @returns 公開中のページだけを変換した配列
 */
export function livePageViews(pages: ManagedPage[]): Page[] {
  return livePages(pages).map(toPageView);
}

/** ページストア。 */
export interface PageStore {
  list(options?: { status?: PageStatus }): Promise<ManagedPage[]>;
  get(slug: string): Promise<ManagedPage | undefined>;
  create(input: PageInput): Promise<ManagedPage>;
  update(slug: string, input: PageInput): Promise<ManagedPage | undefined>;
  remove(slug: string): Promise<boolean>;
}

/**
 * ページストアのメモリ実装(開発・テスト用)。
 *
 * @param seed 初期データ
 * @returns ページストア(**再起動で消える**)
 */
export function createMemoryPageStore(now: () => string = () => new Date().toISOString()): PageStore {
  const bySlug = new Map<string, ManagedPage>();
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
      const page = toManagedPage(input, now());
      bySlug.set(page.slug, page);
      return page;
    },
    async update(slug, input) {
      if (!bySlug.has(slug)) return undefined;
      const page = toManagedPage(input, now());
      if (slug !== page.slug) bySlug.delete(slug);
      bySlug.set(page.slug, page);
      return page;
    },
    async remove(slug) {
      return bySlug.delete(slug);
    },
  };
}

// ── Prisma 実装 ──

/** CmsPageRow の必要部分。 */
export interface CmsPageRow {
  slug: string;
  title: string;
  blocks: unknown;
  status: string;
  updatedAt: Date;
}

interface CmsPageRowData {
  slug: string;
  title: string;
  blocks: PageBlock[];
  status: string;
  updatedAt: Date;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface PageStoreDb {
  cmsPageRow: {
    findMany(args: { where?: { status?: string }; orderBy: { updatedAt: "desc" } }): Promise<CmsPageRow[]>;
    findUnique(args: { where: { slug: string } }): Promise<CmsPageRow | null>;
    create(args: { data: CmsPageRowData }): Promise<CmsPageRow>;
    update(args: { where: { slug: string }; data: CmsPageRowData }): Promise<CmsPageRow>;
    delete(args: { where: { slug: string } }): Promise<unknown>;
  };
}

function rowToPage(row: CmsPageRow): ManagedPage {
  return { slug: row.slug, title: row.title, blocks: Array.isArray(row.blocks) ? (row.blocks as PageBlock[]) : [], status: row.status === "published" ? "published" : "draft", updatedAt: row.updatedAt.toISOString() };
}

function pageToRowData(page: ManagedPage): CmsPageRowData {
  return { slug: page.slug, title: page.title, blocks: page.blocks, status: page.status, updatedAt: new Date(page.updatedAt) };
}

/**
 * ページストアの Prisma 実装(本番用)。
 *
 * @param db Prisma クライアント
 * @returns ページストア
 */
export function createPrismaPageStore(db: PageStoreDb, now: () => string = () => new Date().toISOString()): PageStore {
  return {
    async list(options = {}) {
      const rows = await db.cmsPageRow.findMany({ ...(options.status ? { where: { status: options.status } } : {}), orderBy: { updatedAt: "desc" } });
      return rows.map(rowToPage);
    },
    async get(slug) {
      const row = await db.cmsPageRow.findUnique({ where: { slug } });
      return row ? rowToPage(row) : undefined;
    },
    async create(input) {
      const page = toManagedPage(input, now());
      const row = await db.cmsPageRow.create({ data: pageToRowData(page) });
      return rowToPage(row);
    },
    async update(slug, input) {
      const existing = await db.cmsPageRow.findUnique({ where: { slug } });
      if (!existing) return undefined;
      const page = toManagedPage(input, now());
      const row = await db.cmsPageRow.update({ where: { slug }, data: pageToRowData(page) });
      return rowToPage(row);
    },
    async remove(slug) {
      const existing = await db.cmsPageRow.findUnique({ where: { slug } });
      if (!existing) return false;
      await db.cmsPageRow.delete({ where: { slug } });
      return true;
    },
  };
}
