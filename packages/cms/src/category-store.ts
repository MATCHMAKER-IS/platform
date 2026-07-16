/**
 * カテゴリの管理（CRUD + 並べ替え）。Category 型と階層ロジックは @platform/board。
 * @packageDocumentation
 */
import { type Category } from "@platform/board";

/** カテゴリの入力。 */
export interface CategoryInput {
  name: string;
  slug: string;
  parentId?: string;
  order?: number;
}

/**
 * カテゴリの slug が妥当かを判定する(英小文字・数字・ハイフン)。
 *
 * @param slug 判定する slug
 * @returns 妥当なら true
 */
export function isValidCategorySlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * カテゴリの入力を検証する。
 *
 * @param input 入力
 * @returns 問題の一覧(空なら妥当)
 */
export function validateCategoryInput(input: CategoryInput): { ok: true; value: CategoryInput } | { ok: false; error: string } {
  if (!input.name.trim()) return { ok: false, error: "カテゴリ名は必須です" };
  if (!input.slug || !isValidCategorySlug(input.slug)) return { ok: false, error: "slug は英小文字・数字・ハイフンで指定してください" };
  return { ok: true, value: input };
}

function toCategory(id: string, input: CategoryInput, order: number): Category {
  const c: Category = { id, name: input.name, slug: input.slug, order: input.order ?? order };
  if (input.parentId !== undefined && input.parentId !== "") c.parentId = input.parentId;
  return c;
}

/** カテゴリストア。 */
export interface CategoryStore {
  list(): Promise<Category[]>;
  get(id: string): Promise<Category | undefined>;
  create(input: CategoryInput): Promise<Category>;
  update(id: string, input: CategoryInput): Promise<Category | undefined>;
  remove(id: string): Promise<boolean>;
  /** 指定順に order を振り直す。 */
  reorder(orderedIds: string[]): Promise<Category[]>;
}

function sortByOrder(list: Category[]): Category[] {
  return list.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * カテゴリストアのメモリ実装(開発・テスト用)。
 *
 * @param seed 初期データ
 * @returns カテゴリストア(再起動で消える)
 */
export function createMemoryCategoryStore(genId: () => string = () => `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`): CategoryStore {
  const byId = new Map<string, Category>();
  return {
    async list() {
      return sortByOrder([...byId.values()]);
    },
    async get(id) {
      return byId.get(id);
    },
    async create(input) {
      const id = genId();
      const c = toCategory(id, input, byId.size);
      byId.set(id, c);
      return c;
    },
    async update(id, input) {
      const existing = byId.get(id);
      if (!existing) return undefined;
      const c = toCategory(id, input, existing.order ?? 0);
      byId.set(id, c);
      return c;
    },
    async remove(id) {
      return byId.delete(id);
    },
    async reorder(orderedIds) {
      orderedIds.forEach((id, i) => {
        const c = byId.get(id);
        if (c) byId.set(id, { ...c, order: i });
      });
      return sortByOrder([...byId.values()]);
    },
  };
}

// ── Prisma 実装 ──

/** CategoryRow の必要部分。 */
export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  order: number;
}

interface CategoryRowData {
  name: string;
  slug: string;
  parentId: string | null;
  order: number;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface CategoryStoreDb {
  categoryRow: {
    findMany(args: { orderBy: { order: "asc" } }): Promise<CategoryRow[]>;
    findUnique(args: { where: { id: string } }): Promise<CategoryRow | null>;
    count(): Promise<number>;
    create(args: { data: CategoryRowData & { id?: string } }): Promise<CategoryRow>;
    update(args: { where: { id: string }; data: Partial<CategoryRowData> }): Promise<CategoryRow>;
    delete(args: { where: { id: string } }): Promise<unknown>;
  };
}

function rowToCategory(row: CategoryRow): Category {
  const c: Category = { id: row.id, name: row.name, slug: row.slug, order: row.order };
  if (row.parentId) c.parentId = row.parentId;
  return c;
}

/**
 * カテゴリストアの Prisma 実装(本番用)。
 *
 * @param db Prisma クライアント
 * @returns カテゴリストア
 */
export function createPrismaCategoryStore(db: CategoryStoreDb): CategoryStore {
  return {
    async list() {
      return (await db.categoryRow.findMany({ orderBy: { order: "asc" } })).map(rowToCategory);
    },
    async get(id) {
      const row = await db.categoryRow.findUnique({ where: { id } });
      return row ? rowToCategory(row) : undefined;
    },
    async create(input) {
      const order = input.order ?? (await db.categoryRow.count());
      const row = await db.categoryRow.create({ data: { name: input.name, slug: input.slug, parentId: input.parentId && input.parentId !== "" ? input.parentId : null, order } });
      return rowToCategory(row);
    },
    async update(id, input) {
      const existing = await db.categoryRow.findUnique({ where: { id } });
      if (!existing) return undefined;
      const row = await db.categoryRow.update({ where: { id }, data: { name: input.name, slug: input.slug, parentId: input.parentId && input.parentId !== "" ? input.parentId : null, ...(input.order !== undefined ? { order: input.order } : {}) } });
      return rowToCategory(row);
    },
    async remove(id) {
      const existing = await db.categoryRow.findUnique({ where: { id } });
      if (!existing) return false;
      await db.categoryRow.delete({ where: { id } });
      return true;
    },
    async reorder(orderedIds) {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.categoryRow.update({ where: { id: orderedIds[i]! }, data: { order: i } });
      }
      return (await db.categoryRow.findMany({ orderBy: { order: "asc" } })).map(rowToCategory);
    },
  };
}
