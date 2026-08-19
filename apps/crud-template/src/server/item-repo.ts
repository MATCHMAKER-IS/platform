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
/**
 * 一覧の 1 ページ分。
 *
 * **総件数を必ず返す。** 「3 ページ目」だけでは、
 * **全部見たのか途中なのか**が判断できません——
 * 絞り込みが 0 件なのか、そもそもデータが無いのかも区別できません。
 */
export interface ItemPage {
  items: Item[];
  /** 絞り込み後の総件数（**全データの件数ではない**）。 */
  total: number;
  /** 現在のページ（1 始まり）。 */
  page: number;
  /** 1 ページの件数。 */
  pageSize: number;
  /** 総ページ数（**0 件でも 1** を返す。「0 / 0 ページ」と出さないため）。 */
  pageCount: number;
}

/** 一覧の絞り込み条件。 */
export interface ItemQuery {
  /** 休止中も含めるか。 */
  includeInactive?: boolean;
  /** コード・名前・備考の部分一致。 */
  keyword?: string;
  /** ページ（1 始まり。既定 1）。 */
  page?: number;
  /** 1 ページの件数（既定 20。**上限 100**）。 */
  pageSize?: number;
}

export interface ItemStore {
  list(includeInactive?: boolean): Promise<Item[]>;
  /**
   * ページ単位で取り出す。
   *
   * **一覧の画面はこちらを使ってください。** `list` は全件返すので、
   * **件数が増えた日に画面が固まります**——1,000 件を超えると
   * 描画だけで数秒かかり、「壊れた」と思われます。
   */
  listPage(query?: ItemQuery): Promise<ItemPage>;
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
    async listPage(query = {}) {
      const { includeInactive = false, keyword = "" } = query;
      // **上限を設ける。** `pageSize` は画面のクエリ文字列から渡るので、
      // **`?pageSize=100000` で全件を引かれます**(実質 DoS)
      const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize ?? 20)));
      const word = keyword.trim().toLowerCase();

      const all = [...items.values()]
        .filter((i) => includeInactive || i.active)
        .filter((i) => word === ""
          || i.code.toLowerCase().includes(word)
          || i.name.toLowerCase().includes(word)
          || (i.note ?? "").toLowerCase().includes(word))
        .sort((a, b) => (a.code < b.code ? -1 : 1));

      const total = all.length;
      // **0 件でも 1 ページ。** 「0 / 0 ページ」と出すと壊れて見える
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      // **範囲外のページを渡されても空にしない。** 絞り込みで件数が減ると、
      // **3 ページ目にいたまま該当なし**になり「消えた」と思われる
      const page = Math.min(pageCount, Math.max(1, Math.trunc(query.page ?? 1)));

      return {
        items: all.slice((page - 1) * pageSize, page * pageSize),
        total, page, pageSize, pageCount,
      };
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
/**
 * 絞り込みの条件（Prisma の `where` に渡す形）。
 *
 * **`contains` は SQL の `LIKE`。** Prisma が値をエスケープするので、
 * 利用者の入力をそのまま渡して構いません（`%` を含んでいても安全）。
 */
export interface ItemWhere {
  active?: boolean;
  OR?: { code?: { contains: string; mode: "insensitive" } ;
         name?: { contains: string; mode: "insensitive" };
         note?: { contains: string; mode: "insensitive" } }[];
}

export interface ItemStoreDb {
  itemRow: {
    findMany(args: {
      where?: ItemWhere;
      orderBy: { code: "asc" };
      /** **必ず渡すこと。** 無いと全件返り、件数が増えた日に落ちる */
      skip?: number;
      take?: number;
    }): Promise<ItemRow[]>;
    /** 総件数（ページ数の計算に要る）。 */
    count(args?: { where?: ItemWhere }): Promise<number>;
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
    async listPage(query = {}) {
      const { includeInactive = false, keyword = "" } = query;
      // **上限を設ける。** `?pageSize=100000` で全件を引かれないように
      const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize ?? 20)));
      const word = keyword.trim();

      const where: ItemWhere = {
        ...(includeInactive ? {} : { active: true }),
        ...(word === "" ? {} : {
          OR: [
            { code: { contains: word, mode: "insensitive" } },
            { name: { contains: word, mode: "insensitive" } },
            { note: { contains: word, mode: "insensitive" } },
          ],
        }),
      };

      // **件数を先に取る。** ページ番号の範囲を決めるのに要る
      const total = await db.itemRow.count({ where });
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      // **範囲外のページは最後のページに寄せる。** 絞り込みで件数が減ったとき、
      // 3 ページ目にいたまま該当なしになると「消えた」と思われる
      const page = Math.min(pageCount, Math.max(1, Math.trunc(query.page ?? 1)));

      const rows = await db.itemRow.findMany({
        where, orderBy: { code: "asc" },
        skip: (page - 1) * pageSize, take: pageSize,
      });
      return { items: rows.map(toItem), total, page, pageSize, pageCount };
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
