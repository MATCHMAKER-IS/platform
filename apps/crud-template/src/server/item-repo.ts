/**
 * 品目マスタ(テンプレートのサンプルエンティティ)。エンティティ名・項目を差し替えて使う。
 * パターン: 入力検証(純関数) + ストア(memory / prisma 両実装・最小ポート)。
 * より複雑な検証は zod(@platform/env の z)を推奨(env.ts が実例)。
 * @packageDocumentation
 */

/** 品目。 */
export interface Item {
  code: string;
  name: string;
  note?: string;
  active: boolean;
  createdAt: string;
}

/** 登録/更新の入力。 */
export interface ItemInput {
  code: string;
  name: string;
  note?: string;
}

/** 検証エラー(項目別)。 */
export interface FieldError {
  field: string;
  message: string;
}

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;

/** 入力を検証する。エラーが無ければ ok。 */
export function validateItemInput(input: Partial<ItemInput>): { ok: true; value: ItemInput } | { ok: false; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const code = (input.code ?? "").trim().toUpperCase();
  const name = (input.name ?? "").trim();
  const note = input.note?.trim();
  if (!CODE_RE.test(code)) errors.push({ field: "code", message: "コードは英大文字・数字・ハイフン 2〜20 文字です" });
  if (name.length === 0 || name.length > 100) errors.push({ field: "name", message: "名称は 1〜100 文字で入力してください" });
  if (note && note.length > 500) errors.push({ field: "note", message: "備考は 500 文字以内です" });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { code, name, ...(note ? { note } : {}) } };
}

/** ストア(この形を保てば memory / prisma を差し替えられる)。 */
export interface ItemStore {
  list(includeInactive?: boolean): Promise<Item[]>;
  get(code: string): Promise<Item | undefined>;
  create(input: ItemInput): Promise<Item>;
  update(code: string, patch: { name?: string; note?: string }): Promise<Item | undefined>;
  setActive(code: string, active: boolean): Promise<Item | undefined>;
}

/** インメモリ実装(開発・テスト用)。 */
export function createMemoryItemStore(): ItemStore {
  const items = new Map<string, Item>();
  return {
    async list(includeInactive = false) {
      return [...items.values()].filter((i) => includeInactive || i.active).sort((a, b) => (a.code < b.code ? -1 : 1));
    },
    async get(code) {
      return items.get(code);
    },
    async create(input) {
      const item: Item = { ...input, active: true, createdAt: new Date().toISOString() };
      items.set(item.code, item);
      return { ...item };
    },
    async update(code, patch) {
      const cur = items.get(code);
      if (!cur) return undefined;
      if (patch.name !== undefined) cur.name = patch.name;
      if (patch.note !== undefined) cur.note = patch.note;
      return { ...cur };
    },
    async setActive(code, active) {
      const cur = items.get(code);
      if (!cur) return undefined;
      cur.active = active;
      return { ...cur };
    },
  };
}

// ── Prisma 実装(最小ポート: PrismaClient 全体に依存しない) ──

/** ItemRow の必要部分。 */
export interface ItemRow {
  code: string;
  name: string;
  note: string | null;
  active: boolean;
  createdAt: Date;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface ItemStoreDb {
  itemRow: {
    findMany(args: { where?: { active: boolean }; orderBy: { code: "asc" } }): Promise<ItemRow[]>;
    findUnique(args: { where: { code: string } }): Promise<ItemRow | null>;
    create(args: { data: { code: string; name: string; note: string | null; active: boolean } }): Promise<ItemRow>;
    update(args: { where: { code: string }; data: Partial<{ name: string; note: string | null; active: boolean }> }): Promise<ItemRow>;
  };
}

const toItem = (r: ItemRow): Item => ({ code: r.code, name: r.name, ...(r.note ? { note: r.note } : {}), active: r.active, createdAt: r.createdAt.toISOString() });

/** Prisma 実装。 */
export function createPrismaItemStore(db: ItemStoreDb): ItemStore {
  return {
    async list(includeInactive = false) {
      return (await db.itemRow.findMany({ ...(includeInactive ? {} : { where: { active: true } }), orderBy: { code: "asc" } })).map(toItem);
    },
    async get(code) {
      const r = await db.itemRow.findUnique({ where: { code } });
      return r ? toItem(r) : undefined;
    },
    async create(input) {
      return toItem(await db.itemRow.create({ data: { code: input.code, name: input.name, note: input.note ?? null, active: true } }));
    },
    async update(code, patch) {
      const cur = await db.itemRow.findUnique({ where: { code } });
      if (!cur) return undefined;
      return toItem(await db.itemRow.update({ where: { code }, data: { ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.note !== undefined ? { note: patch.note } : {}) } }));
    },
    async setActive(code, active) {
      const cur = await db.itemRow.findUnique({ where: { code } });
      if (!cur) return undefined;
      return toItem(await db.itemRow.update({ where: { code }, data: { active } }));
    },
  };
}
