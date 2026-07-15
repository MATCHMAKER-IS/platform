/**
 * 備品と貸出履歴(子レコード)。crud-template の品目パターン + 状態遷移(貸出中/在庫あり)。
 * lend / giveBack は業務ルールを返す({ ok, error })。ストアは memory / prisma 両実装。
 * @packageDocumentation
 */

/** 備品。 */
export interface Equipment {
  code: string;
  name: string;
  note?: string;
  active: boolean;
  createdAt: string;
}

/** 貸出1件。 */
export interface Lending {
  id: string;
  code: string;
  borrower: string;
  lentAt: string;
  returnedAt?: string;
}

/** 一覧表示用(貸出中なら借用者付き)。 */
export type EquipmentView = Equipment & { currentBorrower?: string };

/** 登録/更新の入力。 */
export interface EquipmentInput {
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

/** 入力を検証する(crud-template と同じ規則)。 */
export function validateEquipmentInput(input: Partial<EquipmentInput>): { ok: true; value: EquipmentInput } | { ok: false; errors: FieldError[] } {
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

/** 業務操作の結果。 */
export type LendResult = { ok: true; lending: Lending } | { ok: false; error: string };

/** ストア。 */
export interface EquipmentStore {
  list(includeInactive?: boolean): Promise<EquipmentView[]>;
  get(code: string): Promise<EquipmentView | undefined>;
  create(input: EquipmentInput): Promise<Equipment>;
  update(code: string, patch: { name?: string; note?: string }): Promise<Equipment | undefined>;
  setActive(code: string, active: boolean): Promise<Equipment | undefined>;
  /** 貸出。無効品・不在・貸出中・借用者空はエラー。 */
  lend(code: string, borrower: string, now: Date): Promise<LendResult>;
  /** 返却。貸出中でなければエラー。 */
  giveBack(code: string, now: Date): Promise<LendResult>;
  /** 貸出履歴(新しい順)。 */
  history(code: string): Promise<Lending[]>;
}

/** インメモリ実装(開発・テスト用)。 */
export function createMemoryEquipmentStore(): EquipmentStore {
  const items = new Map<string, Equipment>();
  const lendings: Lending[] = [];
  let seq = 0;
  const openLoan = (code: string) => lendings.find((l) => l.code === code && !l.returnedAt);
  const view = (e: Equipment): EquipmentView => {
    const open = openLoan(e.code);
    return { ...e, ...(open ? { currentBorrower: open.borrower } : {}) };
  };
  return {
    async list(includeInactive = false) {
      return [...items.values()].filter((e) => includeInactive || e.active).sort((a, b) => (a.code < b.code ? -1 : 1)).map(view);
    },
    async get(code) {
      const e = items.get(code);
      return e ? view(e) : undefined;
    },
    async create(input) {
      const e: Equipment = { ...input, active: true, createdAt: new Date().toISOString() };
      items.set(e.code, e);
      return { ...e };
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
    async lend(code, borrower, now) {
      const b = borrower.trim();
      if (!b) return { ok: false, error: "借用者は必須です" };
      const eq = items.get(code);
      if (!eq) return { ok: false, error: "備品が見つかりません" };
      if (!eq.active) return { ok: false, error: "無効化された備品は貸出できません" };
      const open = openLoan(code);
      if (open) return { ok: false, error: `貸出中です(借用者: ${open.borrower})` };
      const lending: Lending = { id: `ln${seq++}`, code, borrower: b, lentAt: now.toISOString() };
      lendings.push(lending);
      return { ok: true, lending: { ...lending } };
    },
    async giveBack(code, now) {
      const open = openLoan(code);
      if (!open) return { ok: false, error: "貸出中ではありません" };
      open.returnedAt = now.toISOString();
      return { ok: true, lending: { ...open } };
    },
    async history(code) {
      return lendings.filter((l) => l.code === code).sort((a, b) => (a.lentAt < b.lentAt ? 1 : -1)).map((l) => ({ ...l }));
    },
  };
}

// ── Prisma 実装(最小ポート) ──

/** EquipmentRow の必要部分。 */
export interface EquipmentRow {
  code: string;
  name: string;
  note: string | null;
  active: boolean;
  createdAt: Date;
}

/** LendingRow の必要部分。 */
export interface LendingRow {
  id: string;
  code: string;
  borrower: string;
  lentAt: string;
  returnedAt: string | null;
}

/** 使用する Prisma デリゲートの最小ポート。 */
export interface EquipmentStoreDb {
  equipmentRow: {
    findMany(args: { where?: { active: boolean }; orderBy: { code: "asc" } }): Promise<EquipmentRow[]>;
    findUnique(args: { where: { code: string } }): Promise<EquipmentRow | null>;
    create(args: { data: { code: string; name: string; note: string | null; active: boolean } }): Promise<EquipmentRow>;
    update(args: { where: { code: string }; data: Partial<{ name: string; note: string | null; active: boolean }> }): Promise<EquipmentRow>;
  };
  lendingRow: {
    findFirst(args: { where: { code: string; returnedAt: null } }): Promise<LendingRow | null>;
    findMany(args: { where?: { code?: string; returnedAt?: null }; orderBy: { lentAt: "desc" } }): Promise<LendingRow[]>;
    create(args: { data: { code: string; borrower: string; lentAt: string; returnedAt: string | null } }): Promise<LendingRow>;
    update(args: { where: { id: string }; data: { returnedAt: string } }): Promise<LendingRow>;
  };
}

const toEq = (r: EquipmentRow): Equipment => ({ code: r.code, name: r.name, ...(r.note ? { note: r.note } : {}), active: r.active, createdAt: r.createdAt.toISOString() });
const toLn = (r: LendingRow): Lending => ({ id: r.id, code: r.code, borrower: r.borrower, lentAt: r.lentAt, ...(r.returnedAt ? { returnedAt: r.returnedAt } : {}) });

/** Prisma 実装。 */
export function createPrismaEquipmentStore(db: EquipmentStoreDb): EquipmentStore {
  return {
    async list(includeInactive = false) {
      const [rows, open] = await Promise.all([
        db.equipmentRow.findMany({ ...(includeInactive ? {} : { where: { active: true } }), orderBy: { code: "asc" } }),
        db.lendingRow.findMany({ where: { returnedAt: null }, orderBy: { lentAt: "desc" } }),
      ]);
      const byCode = new Map(open.map((l) => [l.code, l.borrower]));
      return rows.map((r) => ({ ...toEq(r), ...(byCode.has(r.code) ? { currentBorrower: byCode.get(r.code)! } : {}) }));
    },
    async get(code) {
      const r = await db.equipmentRow.findUnique({ where: { code } });
      if (!r) return undefined;
      const open = await db.lendingRow.findFirst({ where: { code, returnedAt: null } });
      return { ...toEq(r), ...(open ? { currentBorrower: open.borrower } : {}) };
    },
    async create(input) {
      return toEq(await db.equipmentRow.create({ data: { code: input.code, name: input.name, note: input.note ?? null, active: true } }));
    },
    async update(code, patch) {
      const cur = await db.equipmentRow.findUnique({ where: { code } });
      if (!cur) return undefined;
      return toEq(await db.equipmentRow.update({ where: { code }, data: { ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.note !== undefined ? { note: patch.note } : {}) } }));
    },
    async setActive(code, active) {
      const cur = await db.equipmentRow.findUnique({ where: { code } });
      if (!cur) return undefined;
      return toEq(await db.equipmentRow.update({ where: { code }, data: { active } }));
    },
    async lend(code, borrower, now) {
      const b = borrower.trim();
      if (!b) return { ok: false, error: "借用者は必須です" };
      const eq = await db.equipmentRow.findUnique({ where: { code } });
      if (!eq) return { ok: false, error: "備品が見つかりません" };
      if (!eq.active) return { ok: false, error: "無効化された備品は貸出できません" };
      const open = await db.lendingRow.findFirst({ where: { code, returnedAt: null } });
      if (open) return { ok: false, error: `貸出中です(借用者: ${open.borrower})` };
      const created = await db.lendingRow.create({ data: { code, borrower: b, lentAt: now.toISOString(), returnedAt: null } });
      return { ok: true, lending: toLn(created) };
    },
    async giveBack(code, now) {
      const open = await db.lendingRow.findFirst({ where: { code, returnedAt: null } });
      if (!open) return { ok: false, error: "貸出中ではありません" };
      const updated = await db.lendingRow.update({ where: { id: open.id }, data: { returnedAt: now.toISOString() } });
      return { ok: true, lending: toLn(updated) };
    },
    async history(code) {
      return (await db.lendingRow.findMany({ where: { code }, orderBy: { lentAt: "desc" } })).map(toLn);
    },
  };
}
